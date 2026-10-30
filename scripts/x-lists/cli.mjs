import { loadLocalEnv } from './env.mjs';

try {
  await loadLocalEnv();
  const { main } = await import('./run.mjs');
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Command failed');
  process.exitCode = 1;
}
