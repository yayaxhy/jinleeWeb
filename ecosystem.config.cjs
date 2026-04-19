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
  ],
};
