import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const port = 3000;
const app = express();

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


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});