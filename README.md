# CrisisLogistics

نظام إدارة الطوارئ والإمداد الطبي: Web App لغرفة تحكم الإسعاف بيستقبل البلاغات، يحدد خطورة كل حالة بموديل ML، يرتّبها بالأولوية، ويختار أقرب إسعاف متاحة وأنسب مستشفى بأقصر طريق.

## الأجزاء

| الجزء | التقنية | البورت | الفولدر |
|---|---|---|---|
| Frontend | React + Vite, React-Leaflet, Axios | 5173 | `client/` |
| Backend | Node.js + Express, pg | 4000 | `server/` |
| AI Service | Python + Flask, scikit-learn, joblib | 5000 | `ai-service/` |
| Database | PostgreSQL | 5432 | `server/db/` |

## التيم

| الاسم | المسؤولية | الملفات |
|---|---|---|
| بندق | AI & Machine Learning | `ai-service/` |
| فستق | Backend | `server/index.js`, `server/routes/` |
| كاجو | Database | `server/db/` |
| لوز | Sorting & Priority | `server/algorithms/priorityQueue.js` |
| عين جمل | Search & Route | `server/algorithms/dijkstra.js`, `server/data/graph.json` |
| فول سوداني | Ambulance & Hospital | `server/algorithms/dispatcher.js` |
| لوزة | Frontend & Integration | `client/` |

## البداية

```bash
git clone https://github.com/haninotarek/CrisisLogistics.git
cd CrisisLogistics
```

- **`client/`:** لوزة تنشئه من جذر الريبو بأمر `npm create vite@latest client -- --template react`.
- **`server/`:** فستق يشغّل `npm init -y` جوه الفولدر، وكل واحد ينسخ `.env.example` لملف `.env`.
- **`ai-service/`:** بندق يعمل `venv` جوه الفولدر ويضيف `requirements.txt`.

## قواعد الشغل

- مفيش شغل مباشر على `main`. كل واحد يفتح branch باسم زي `feature/priority-queue` ويرفع Pull Request.
- كل واحد يعدّل في الملفات بتاعته بس، ولو محتاج تغيير في جزء تاني يتفق مع صاحبه.
- `git pull origin main` في بداية كل يوم.
- ملف `.env` مايترفعش على GitHub.
