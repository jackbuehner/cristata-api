import { Extension, onConnectPayload } from '@hocuspocus/server';
import fetch from 'node-fetch';

export interface AuthenticateConfiguration {
  authHref: string;
}

class Authenticate implements Extension {
  configuration: AuthenticateConfiguration;

  constructor(configuration: AuthenticateConfiguration) {
    this.configuration = configuration;
  }

  async onConnect({ connection, requestHeaders }: onConnectPayload): Promise<void> {
    // always start off as unauthenticated
    connection.requiresAuthentication = true;
    connection.isAuthenticated = false;

    // check authentication status
    const authRes = await fetch(this.configuration.authHref, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        cookie: requestHeaders.cookie || '',
      },
    });

    if (authRes.status === 200) {
      connection.isAuthenticated = true;
    } else {
      // prevent later hooks and default handler
      throw new Error();
    }
  }
}

export { Authenticate };