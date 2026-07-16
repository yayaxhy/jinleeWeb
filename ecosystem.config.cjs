module.exports = {
  apps: [
    {
      name: 'jinlee-web',
      cwd: '/www/wwwroot/jinleeWeb',
      script: 'npm',
      args: 'start -- --hostname 127.0.0.1 --port 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
    {
      name: 'jinlee-monthly-financial-reports',
      cwd: '/www/wwwroot/jinleeWeb',
      script: 'scripts/monthly-financial-report-scheduler.mjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        REPORT_GENERATOR_URL: 'http://127.0.0.1:3000/api/admin/revenue/files/generate-due',
        REPORT_GENERATOR_TIME_ZONE: 'Europe/Rome',
      },
    },
  ],
};
