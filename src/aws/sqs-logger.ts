/**
 * AWS SQS Logger for Analytics Events
 *
 * Sends analytics events to SQS FIFO queue in fire-and-forget mode
 * using ctx.waitUntil() to ensure zero impact on response time.
 *
 * Uses Lambda HTTP bridge for secure, reliable event delivery
 * (simpler than implementing SigV4 in edge runtime)
 */

// SQS/Analytics Configuration
interface SQSConfig {
  lambdaUrl?: string;  // HTTP endpoint for Lambda bridge
  queueUrl?: string;   // Direct SQS queue (fallback)
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

// Analytics event types (matching Processor Lambda expectations)
export interface QueryEvent {
  eventType: 'query';
  requestId: string;        // Changed from correlationId to match Lambda
  timestamp: number;
  query: string;
  sessionId?: string;       // Optional session tracking
  metadata?: {
    userAgent?: string;
    referer?: string;
    [key: string]: unknown;
  };
}

export interface ResponseEvent {
  eventType: 'response';
  requestId: string;        // Changed from correlationId to match Lambda
  timestamp: number;
  matchType: 'full' | 'partial' | 'none';
  matchScore: number;       // 0-100
  reasoning: string;
  vectorMatches?: number;
  sessionId?: string;
  performance?: {           // Keep for additional context
    totalTime: number;
    llmTime: number;
    retrievalTime: number;
    cacheHit: boolean;
  };
  metadata?: {
    matchQuality?: number;
    sourcesUsed?: string[];
    [key: string]: unknown;
  };
}

export type AnalyticsEvent = QueryEvent | ResponseEvent;

/**
 * SQS Logger class with singleton pattern using HTTP API
 */
class SQSLogger {
  private config: SQSConfig | null = null;

  /**
   * Initialize SQS logger with configuration
   */
  initialize(config: SQSConfig): void {
    this.config = config;
  }

  /**
   * Check if logger is initialized
   */
  isInitialized(): boolean {
    return this.config !== null;
  }

  /**
   * Send analytics event to SQS FIFO queue with AWS SigV4 authentication
   */
  async sendEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.config) {
      console.warn('SQS Logger not initialized, skipping event');
      return;
    }

    try {
      if (!this.config.queueUrl) {
        console.warn('No queue URL configured, skipping event');
        return;
      }

      // Build SQS SendMessage request
      const messageBody = JSON.stringify(event);
      const messageGroupId = 'analytics';
      const messageDeduplicationId = `${event.requestId}-${event.eventType}-${event.timestamp}`;

      // Create form-encoded payload for SQS Query API
      const params = new URLSearchParams();
      params.append('Action', 'SendMessage');
      params.append('Version', '2012-11-05');
      params.append('MessageBody', messageBody);
      params.append('MessageGroupId', messageGroupId);
      params.append('MessageDeduplicationId', messageDeduplicationId);

      const payload = params.toString();

      // Parse queue URL
      const url = new URL(this.config.queueUrl);
      const host = url.hostname;
      const path = url.pathname;

      // Generate AWS SigV4 signature
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.substring(0, 8);

      // Step 1: Create canonical request
      const method = 'POST';
      const canonicalUri = path;
      const canonicalQueryString = '';
      const payloadHash = await this.sha256(payload);

      const canonicalHeaders =
        `content-type:application/x-www-form-urlencoded\n` +
        `host:${host}\n` +
        `x-amz-date:${amzDate}\n`;

      const signedHeaders = 'content-type;host;x-amz-date';

      const canonicalRequest =
        `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`; 

      // Step 2: Create string to sign
      const algorithm = 'AWS4-HMAC-SHA256';
      const credentialScope = `${dateStamp}/${this.config.region}/sqs/aws4_request`;
      const canonicalRequestHash = await this.sha256(canonicalRequest);

      const stringToSign =
        `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

      // Step 3: Calculate signature
      const signature = await this.calculateSignature(
        this.config.secretAccessKey,
        dateStamp,
        this.config.region,
        'sqs',
        stringToSign
      );

      // Step 4: Build Authorization header
      const authorizationHeader =
        `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`;

      // Step 5: Send signed request to SQS
      const response = await fetch(this.config.queueUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Host': host,
          'X-Amz-Date': amzDate,
          'Authorization': authorizationHeader,
        },
        body: payload,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`SQS error [${response.status}]: ${text.substring(0, 200)}`);
        return;
      }

      console.log(`Ô£à Analytics event sent: ${event.eventType} - ${event.requestId}`);
    } catch (error) {
      // Log error but don't throw - analytics should never break the app
      console.error('Failed to send analytics event:', error instanceof Error ? error.message : String(error));       
    }
  }

  /**
   * Calculate AWS SigV4 signature using Web Crypto API
   */
  private async calculateSignature(
    secretKey: string,
    dateStamp: string,
    region: string,
    service: string,
    stringToSign: string
  ): Promise<string> {
    // Key derivation: kSecret -> kDate -> kRegion -> kService -> kSigning
    const kSecret = `AWS4${secretKey}`;
    const kDate = await this.hmacSha256(kSecret, dateStamp);
    const kRegion = await this.hmacSha256(kDate, region);
    const kService = await this.hmacSha256(kRegion, service);
    const kSigning = await this.hmacSha256(kService, 'aws4_request');

    // Final signature
    const signature = await this.hmacSha256(kSigning, stringToSign);
    return this.toHex(signature);
  }

  /**
   * SHA256 hash using Web Crypto API
   */
  private async sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return this.toHex(hashBuffer);
  }

  /**
   * HMAC-SHA256 using Web Crypto API
   */
  private async hmacSha256(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();

    // Import key
    let keyBuffer: BufferSource;
    if (typeof key === 'string') {
      keyBuffer = encoder.encode(key);
    } else {
      keyBuffer = key;
    }

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign data
    const dataBuffer = encoder.encode(data);
    return await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  }

  /**
   * Convert ArrayBuffer to hex string
   */
  private toHex(buffer: ArrayBuffer): string {
    const byteArray = new Uint8Array(buffer);
    return Array.from(byteArray)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create query event
   */
  createQueryEvent(
    requestId: string,
    sessionId: string,
    query: string,
    metadata?: QueryEvent['metadata']
  ): QueryEvent {
    return {
      eventType: 'query',
      requestId,
      timestamp: Date.now(),
      sessionId,
      query,
      metadata,
    };
  }

  /**
   * Create response event
   */
  createResponseEvent(
    requestId: string,
    sessionId: string,
    matchType: 'full' | 'partial' | 'none',
    matchScore: number,
    reasoning: string,
    performance?: ResponseEvent['performance'],
    vectorMatches?: number,
    metadata?: ResponseEvent['metadata']
  ): ResponseEvent {
    return {
      eventType: 'response',
      requestId,
      timestamp: Date.now(),
      matchType,
      matchScore,
      reasoning,
      vectorMatches,
      sessionId,
      performance,
      metadata,
    };
  }
}

// Singleton instance
export const sqsLogger = new SQSLogger();

/**
 * Initialize SQS logger from environment variables
 */
export function initializeSQSLogger(env: {
  AWS_SQS_URL?: string;
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
}): boolean {
  const queueUrl = env.AWS_SQS_URL;
  const region = env.AWS_REGION || 'us-east-1';
  const accessKeyId = env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;

  // Analytics is optional - only initialize if all credentials are present
  if (!queueUrl || !accessKeyId || !secretAccessKey) {
    console.log('SQS analytics disabled (missing credentials)');
    return false;
  }

  sqsLogger.initialize({
    queueUrl,
    region,
    accessKeyId,
    secretAccessKey,
  });

  console.log('SQS analytics enabled');
  return true;
}
