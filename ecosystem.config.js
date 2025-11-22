module.exports = {
  apps: [
    {
      name: 'jeopardy-backend',
      cwd: './be-jeopardy',
      script: 'make',
      args: 'run',
      env: {
        PORT: '8080',
        GIN_MODE: 'debug',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5434/postgres?sslmode=disable',
        ALLOW_ORIGIN: 'http://localhost:4200'
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'jeopardy-frontend',
      cwd: './fe-jeopardy',
      script: 'pnpm',
      args: 'run ng build --configuration production',
      autorestart: false,
      watch: false,
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
