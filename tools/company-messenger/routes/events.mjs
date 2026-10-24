import { NOT_HANDLED } from './request-router.mjs';

// Owns the events HTTP contract; authentication stays in the request context.
export function createEventsRoutes({ bridge, subscribers, validSubscriber }) {
  return function handle(context) {
    const { method, p, req, res } = context;
    if (method === 'GET' && p === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n: connected\n\n');
      const client = { res, userId: context.user.id, token: context.auth.token, req, accessKey: bridge?.accessKey(context.user.id) };
      subscribers.add(client);
      const heartbeat = setInterval(() => {
        if (!validSubscriber(client)) { res.end(); return; }
        res.write(': keepalive\n\n');
      }, 20000);
      heartbeat.unref();
      res.on('close', () => { clearInterval(heartbeat); subscribers.delete(client); });
      return;
    }
    return NOT_HANDLED;
  };
}
