import 'dotenv/config';
import express from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json' with { type: 'json' };
// Bloco 1: Configuracao inicial da aplicacao (porta e instancia do Express).
const port = 3000;
const app = express();
// Bloco 2: Middlewares globais.
// - express.json(): permite receber JSON no corpo das requisicoes.
app.use(express.json());
// Bloco 3: Documentacao da API em /docs usando Swagger UI.
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// Bloco 4: Leitura da variavel de ambiente para conexao com o banco.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in .env');
}
// Bloco 5: Configuracao do Prisma com o adapter do Postgres.
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
// Bloco 5.1: Funcoes auxiliares para validar e converter os dados recebidos.
// Isso evita erro 500 quando o Swagger envia valores em formato diferente do esperado.
function parseIntegerField(value, fieldName) {
    const parsedValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsedValue)) {
        throw new Error(`Field ${fieldName} must be an integer.`);
    }
    return parsedValue;
}
function parseDateField(value, fieldName) {
    const parsedValue = new Date(String(value));
    if (Number.isNaN(parsedValue.getTime())) {
        throw new Error(`Field ${fieldName} must be a valid date.`);
    }
    return parsedValue;
}
// Bloco 6: Rota para listar todos os filmes (ordenados por titulo).
app.get('/movies', async (_, res) => {
    const movies = await prisma.movie.findMany({
        orderBy: {
            title: 'asc',
        },
        include: {
            genres: true,
            languages: true,
        },
    });
    res.json(movies);
});
// Bloco 7: Rota para criar filme.
// Regras aplicadas:
// - evita titulo duplicado (ignorando maiusculas/minusculas);
// - converte release_date para Date antes de salvar.
app.post('/movies', async (req, res) => {
    const { title, genre_id, language_id, oscar_count, release_date } = req.body;
    try {
        const movieWithSameTitle = await prisma.movie.findFirst({
            where: { title: { equals: title, mode: 'insensitive' } },
        });
        if (movieWithSameTitle) {
            return res.status(409).json({
                error: 'A movie with the same title already exists.',
            });
        }
        await prisma.movie.create({
            data: {
                title,
                genre_id,
                language_id,
                oscar_count,
                release_date: new Date(release_date),
            },
        });
        res.status(201).send();
    }
    catch (error) {
        res.status(500).json({
            error: 'An error occurred while creating the movie.',
        });
    }
});
// Bloco 8: Rota para atualizar filme por ID.
// Aceita campos parciais: apenas os campos enviados no body serao atualizados.
app.put('/movies/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { title, genre_id, language_id, oscar_count, release_date } = req.body;
    try {
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'Movie id must be an integer.' });
        }
        if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
            return res.status(400).json({
                error: 'Field title must be a non-empty string.',
            });
        }
        const data = {};
        if (title !== undefined)
            data.title = title.trim();
        if (genre_id !== undefined)
            data.genre_id = parseIntegerField(genre_id, 'genre_id');
        if (language_id !== undefined)
            data.language_id = parseIntegerField(language_id, 'language_id');
        if (oscar_count !== undefined)
            data.oscar_count = parseIntegerField(oscar_count, 'oscar_count');
        if (release_date !== undefined)
            data.release_date = parseDateField(release_date, 'release_date');
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'No fields provided to update.' });
        }
        const movie = await prisma.movie.findUnique({ where: { id } });
        if (!movie) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        if (data.title) {
            const movieWithSameTitle = await prisma.movie.findFirst({
                where: {
                    title: { equals: data.title, mode: 'insensitive' },
                    NOT: { id },
                },
            });
            if (movieWithSameTitle) {
                return res.status(409).json({
                    error: 'A movie with the same title already exists.',
                });
            }
        }
        const updatedMovie = await prisma.movie.update({
            where: { id },
            data,
            include: {
                genres: true,
                languages: true,
            },
        });
        return res.status(200).json(updatedMovie);
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2003') {
                return res.status(400).json({
                    error: 'genre_id or language_id is invalid.',
                });
            }
        }
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({
            error: 'An error occurred while updating the movie.',
        });
    }
});
// Bloco 9: Rota para remover filme por ID.
// Primeiro verifica se o filme existe para retornar 404 quando necessario.
app.delete('/movies/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
        const movie = await prisma.movie.findUnique({ where: { id } });
        if (!movie) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        await prisma.movie.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({
            error: 'An error occurred while deleting the movie.',
        });
    }
});
// Bloco 10: Rota para filtrar filmes por nome do genero.
// A busca e case-insensitive para facilitar a consulta.
app.get('/movies/:genreName', async (req, res) => {
    try {
        const moviesFilteredByGenreName = await prisma.movie.findMany({
            include: {
                genres: true,
                languages: true,
            },
            where: {
                genres: {
                    name: {
                        equals: req.params.genreName,
                        mode: 'insensitive',
                    },
                },
            },
        });
        res.status(200).send(moviesFilteredByGenreName);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
// Bloco 10.1: Middleware para capturar JSON invalido enviado no body.
// Isso acontece antes de chegar na rota quando o corpo nao segue o padrao JSON.
app.use((error, _req, res, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({
            error: 'Invalid JSON. Use double quotes in property names and string values.',
            example: {
                title: 'Cisne negro',
                genre_id: 5,
                language_id: 2,
                oscar_count: 1,
                release_date: '2011-02-04',
            },
        });
    }
    next(error);
});
// Bloco 11: Inicializacao do servidor HTTP.
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
//# sourceMappingURL=serve.js.map