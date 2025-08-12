import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NotificationProvider } from './NotificationProvider';
import { notify } from './notificationService';

describe('NotificationProvider', () => {
  it('shows notifications', async () => {
    render(
      <NotificationProvider>
        <div>test</div>
      </NotificationProvider>
    );
    notify('hola');
    const el = await screen.findByText('hola');
    expect(el).toBeTruthy();
  });
});
