import { describe, expect, it, vi } from 'vitest';
import { healthRepository } from '../../src/repositories/health.repository';
import { healthService } from '../../src/services/health.service';
import { api } from '../helpers/factories';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('health probes', () => {
  it('GET /health returns 200 with status, uptime and version', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', version: expect.any(String) });
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('GET /health/ready returns 200 when the database answers', async () => {
    const res = await api().get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', checks: { database: 'up' } });
  });

  it('GET /health/ready returns 503 when the database does not answer', async () => {
    vi.spyOn(healthRepository, 'ping').mockRejectedValueOnce(new Error('connection refused'));
    const res = await api().get('/api/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'unavailable', checks: { database: 'down' } });
  });
});

describe('request ids', () => {
  it('generates a UUID when the client sends none', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('reuses a safe id sent by the client', async () => {
    const res = await api().get('/api/v1/health').set('X-Request-Id', 'debug-samuel-001');
    expect(res.headers['x-request-id']).toBe('debug-samuel-001');
  });

  it('replaces an id that could inject junk into the logs', async () => {
    const res = await api().get('/api/v1/health').set('X-Request-Id', '<script>alert(1)</script>');
    expect(res.headers['x-request-id']).toMatch(UUID);
  });
});

describe('error format (RFC 9457)', () => {
  it('answers an unknown route with a 404 Problem Details carrying the request id', async () => {
    const res = await api().get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({
      type: 'https://triage-api.dev/errors/not-found',
      status: 404,
      code: 'NOT_FOUND',
      instance: '/api/v1/does-not-exist',
      requestId: res.headers['x-request-id'],
    });
  });

  it('answers malformed JSON with 400 VALIDATION_ERROR before any route runs', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ "email": ');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      detail: 'Request body is not valid JSON.',
    });
  });

  it('turns an unexpected error into a generic 500 that leaks nothing', async () => {
    vi.spyOn(healthService, 'getStatus').mockImplementationOnce(() => {
      throw new Error('secret internal detail');
    });
    const res = await api().get('/api/v1/health');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR', title: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });
});
