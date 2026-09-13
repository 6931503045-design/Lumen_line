import app from './app.js';
import { config } from './config.js';

const port = config.port;

app.listen(port, () => {
  console.log(`JOD tang backend listening on http://localhost:${port}`);
});
