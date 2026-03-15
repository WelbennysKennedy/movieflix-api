import 'dotenv/config'
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const port = 3000
const app = express()

app.use(express.json())

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in .env')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

app.get('/movies', async (_, res) => {
    const movies = await prisma.movies.findMany({
        orderBy: {
            title: 'asc',
        },
        include: {
            genres: true,
            languages: true,
        },
    })
    res.json(movies)
})

app.post('/movies', async (req, res) => {
    const { title, genre_id, language_id, oscar_count, release_date } = req.body

    try {
        // veririficar no banco de dados se ja existe um filme com o nome igual ao que esta sendo enviado.

        const movieWhithSameTitle = await prisma.movies.findFirst({
            where: { title: { equals: title, mode: 'insensitive' } },
        })

        if (movieWhithSameTitle) {
            return res.status(409).json({
                error: 'A movie with the same title already exists.',
            })
        }

        await prisma.movies.create({
            data: {
                title,
                genre_id,
                language_id,
                oscar_count,
                release_date: new Date(release_date),
            },
        })

        res.status(201).send()
    } catch (error) {
        res.status(500).json({
            error: 'An error occurred while creating the movie.',
        })
    }
})

app.put('/movies/:id', async (req, res) => {
        const id = Number(req.params.id)

        try {
                const result = await prisma.movies.updateMany({
                        where: { id },
                        data: {
                                release_date: new Date(req.body.release_date),
                        },
                })

                if (result.count === 0) {
                        return res.status(404).json({ error: 'Movie not found' })
                }

                const updatedMovie = await prisma.movies.findUnique({
                        where: { id },
                })

                return res.status(200).json(updatedMovie)
        } catch (error) {
                return res.status(500).json({
                        error: 'An error occurred while updating the movie.',
                })
        }
})

app.delete('/movies/:id', async (req, res) => {
        const id = Number(req.params.id);

        try {
        const movie = await prisma.movies.findUnique({ where: { id } });
        if (!movie) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        await prisma.movies.delete({where: {id}})
        res.status(204).send()
        } catch (error) {
        res.status(500).json({ error: 'An error occurred while deleting the movie.' });
        }
           });




app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})
