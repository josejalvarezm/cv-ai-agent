-- returns comma-separated ids of technologies
SELECT group_concat(id, ',') AS ids FROM technology;
