import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Research Copilot API',
        version: '1.0.0',
        description: 'AI-powered banking research platform API',
        contact: {
          name: 'Research Copilot Team',
        },
      },
      servers: [
        {
          url: process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}/api`
            : 'http://localhost:3000/api',
          description: 'API Server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  });
  return spec;
};
