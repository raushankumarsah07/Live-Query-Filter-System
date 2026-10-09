# Live Query Filter System (MERN)

Search and filter grid with a debounced search box, multi-category filtering, sorting, pagination, loading/empty/error states, and a MongoDB-backed search API.

## Run locally
1. `npm install` then `npm install --prefix client`
2. Copy `.env.example` to `.env` and set `MONGODB_URI`
3. `npm run dev`, then open http://localhost:5173 (API on :4000)

The server loads `server/data/live_filter_catalog.json` (250 records) when the database is empty. `npm run seed` resets it.

## API
`GET /api/items?search=&category=Design,Security&level=Beginner&sort=rating&page=1&limit=12`

Returns `{ items, total, page, pages, limit, facets }`. `sort` is one of `default`, `rating`, `duration`, `title`.
`GET /api/meta` returns the available categories and levels.

## Deploy (Render + MongoDB Atlas)
Build Command: `npm install && npm run build`  
Start Command: `npm start`  
Environment variable: `MONGODB_URI`
