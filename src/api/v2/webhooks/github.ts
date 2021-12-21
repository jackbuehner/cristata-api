import GithubWebHook from 'express-github-webhook';
import { wss } from '../../../websocket';

/**
 * Recieve and handle webhook payloads from GitHub.
 */
const handler = GithubWebHook({
  path: '/payload/github',
  secret: process.env.GITHUB_PAYLOAD_SECRET,
});

// handle incoming webhook payloads from github
handler.on('project_card', (repo: string, data: { [key: string]: unknown }) => {
  const emitData = {
    event: 'project_card',
    project_id: parseInt((data.project_card as { project_url: string }).project_url.split('/').pop()), // get the project id by popping it from the end of the project url
    column_id: (data.project_card as { column_id: number }).column_id,
    card_id: (data.project_card as { id: number }).id,
  };
  wss.emit('github_payload_received', JSON.stringify(emitData));
});
handler.on('project_column', (repo: string, data: { [key: string]: unknown }) => {
  const emitData = {
    event: 'project_column',
    project_id: parseInt((data.project_column as { project_url: string }).project_url.split('/').pop()), // get the project id by popping it from the end of the project url
    column_id: (data.project_column as { id: number }).id,
  };
  wss.emit('github_payload_received', JSON.stringify(emitData));
});
handler.on('project', (repo: string, data: { [key: string]: unknown }) => {
  const emitData = {
    event: 'project',
    project_id: (data.project as { id: number }).id,
  };
  wss.emit('github_payload_received', JSON.stringify(emitData));
});

export { handler as githubWebhookHandler };
