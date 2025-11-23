# Real-Time Dashboard: React, TypeScript, and Firestore WebSockets

## Quick Summary

- ✓ **React + TypeScript + Vite** for modern frontend development
- ✓ **Firestore real-time listeners** provide WebSocket updates (no polling)
- ✓ **Recharts** for responsive data visualization
- ✓ **Firebase Hosting** with global CDN (sub-100ms latency)
- ✓ **Performance optimization** through code splitting and lazy loading

---

## Introduction

[Content to be written following guidelines: British English, ✓ symbols, no em dashes, professional tone]

**Topics to cover:**
- Why real-time matters for analytics
- The inefficiency of polling
- How WebSockets enable instant updates
- Building production-grade React apps

---

## React Setup: Vite + TypeScript + Tailwind

[Content to be written]

**Topics:**
- Vite build tool (faster than webpack)
- TypeScript for type safety
- Tailwind CSS for styling
- Project structure
- Development workflow

**Project structure:**
```
dashboard/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── AnalyticsChart.tsx
│   │   └── QueryList.tsx
│   ├── lib/
│   │   └── firebase.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

---

## Firestore Integration: Real-Time Listeners

[Content to be written]

**Topics:**
- Firebase SDK setup
- `onSnapshot()` for real-time updates
- Collection queries
- Document listeners
- Unsubscribing properly (memory leaks)

**Code example:**
```typescript
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const q = query(
  collection(db, 'analytics'),
  orderBy('timestamp', 'desc')
);

const unsubscribe = onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      console.log('New query:', change.doc.data());
    }
  });
});

// Cleanup on unmount
return () => unsubscribe();
```

---

## Data Visualization with Recharts

[Content to be written]

**Topics:**
- Recharts library
- Line charts for trends
- Bar charts for comparisons
- Responsive design
- Custom tooltips

**Code example:**
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

function AnalyticsChart({ data }) {
  return (
    <LineChart width={600} height={300} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="queries" stroke="#1976d2" />
    </LineChart>
  );
}
```

**Mermaid diagram:** Component hierarchy

---

## State Management: React Hooks

[Content to be written]

**Topics:**
- `useState` for local state
- `useEffect` for side effects (Firestore listeners)
- Custom hooks for reusability
- Context API for global state (if needed)
- Avoiding prop drilling

**Custom hook example:**
```typescript
function useAnalytics() {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'analytics'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data());
        setQueries(data);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { queries, loading };
}
```

---

## Firebase Deployment

[Content to be written]

**Topics:**
- Firebase Hosting configuration
- Build optimization
- CDN and global edge locations
- Custom domain setup
- HTTPS by default

**Deployment commands:**
```bash
npm run build        # Vite production build
firebase deploy      # Upload to Firebase Hosting
```

**`firebase.json` configuration:**
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

---

## Performance Optimization

[Content to be written]

**Topics:**
- Code splitting with lazy loading
- Memoization (`React.memo`, `useMemo`)
- Debouncing Firestore queries
- Image optimization
- Lighthouse scores

**Lazy loading example:**
```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./components/Dashboard'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Dashboard />
    </Suspense>
  );
}
```

---

## Trade-offs: Real-Time vs Polling

[Content to be written]

**Topics:**
- WebSocket connection overhead
- Firestore read costs (real-time counts as reads)
- When NOT to use real-time (batch analytics)
- Polling for non-critical updates
- Cost optimization strategies

---

## Practical Takeaways

[Content to be written]

**Key points:**
- ✓ Vite for fast builds
- ✓ TypeScript for safety
- ✓ Firestore for real-time updates
- ✓ Recharts for visualization
- ✓ Firebase Hosting for global CDN

---

## What's Next

**Part 8: Serverless Cost Optimization**

Dashboard built. Now: how to keep it running at £0/month.

Part 8 covers:
- ✓ AWS Lambda free tier (1M requests/month)
- ✓ DynamoDB always-free tier (25 GB)
- ✓ GCP Cloud Functions free tier (2M invocations/month)
- ✓ Batching strategies to reduce invocations
- ✓ Cost monitoring and alerts

**Focus:** Production-grade system with zero hosting costs.

---

## Further Reading

- [Vite Documentation](https://vitejs.dev/)
- [Firestore Real-Time Updates](https://firebase.google.com/docs/firestore/query-data/listen)
- [Recharts Documentation](https://recharts.org/)
