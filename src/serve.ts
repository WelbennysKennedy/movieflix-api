import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const port = 3000;
const app = express();

app.use(express.json());

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in .env');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

app.get('/movies', async (_, res) => {
  const movies = await prisma.movies.findMany({
    orderBy: {
      title: 'asc'
    },
    include: {
      genres: true,
      languages: true,
    }
  });
  res.json(movies);
});

app.post('/movies', async (req, res) => {

 const { title, genre_id, language_id, oscar_count, release_date } = req.body;
  
try {
  await prisma.movies.create({
      data: {
      title,
      genre_id,
      language_id,
      oscar_count,
      release_date: new Date(release_date)
    }
  });

  res.status(201).send();
} catch (error) {
  res.status(500).json({ error: 'An error occurred while creating the movie.' });
}
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});