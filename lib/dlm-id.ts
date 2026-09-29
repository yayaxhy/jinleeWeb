import cuid from 'cuid';

export const generateDlmId = () => `dlm${cuid()}`;
