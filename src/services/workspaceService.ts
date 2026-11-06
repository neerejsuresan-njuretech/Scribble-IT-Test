import { getAccessToken } from '../lib/firebase';

// Helper to make authenticated requests to Google APIs using client-side Bearer token
async function callGoogleApi(url: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google Workspace. Please sign in with your Google account.');
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = { error: { message: errorText } };
    }
    throw new Error(parsed?.error?.message || `Google API error (${res.status})`);
  }

  return res.json();
}

// ------------------- Google Drive Service -------------------
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  size?: string;
}

export const driveService = {
  async listFiles(pageSize = 15): Promise<DriveFile[]> {
    const data = await callGoogleApi(
      `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size)&orderBy=modifiedTime desc`
    );
    return data.files || [];
  },

  async uploadTextFile(name: string, content: string, mimeType = 'text/plain'): Promise<DriveFile> {
    const token = await getAccessToken();
    const metadata = { name, mimeType };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: mimeType }));

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });

    if (!res.ok) throw new Error('Failed to upload file to Google Drive');
    return res.json();
  }
};

// ------------------- Google Forms Service -------------------
export interface GoogleForm {
  formId: string;
  info: {
    title: string;
    description?: string;
    documentTitle?: string;
  };
  responderUri?: string;
}

export interface FormResponse {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answers?: Record<string, { textAnswers?: { answers?: { value: string }[] } }>;
}

export const formsService = {
  async listForms(): Promise<DriveFile[]> {
    const data = await callGoogleApi(
      `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.form'&fields=files(id,name,webViewLink,modifiedTime)&pageSize=10`
    );
    return data.files || [];
  },

  async getForm(formId: string): Promise<GoogleForm> {
    return callGoogleApi(`https://forms.googleapis.com/v1/forms/${formId}`);
  },

  async getFormResponses(formId: string): Promise<FormResponse[]> {
    try {
      const data = await callGoogleApi(`https://forms.googleapis.com/v1/forms/${formId}/responses`);
      return data.responses || [];
    } catch {
      return [];
    }
  },

  async createITIntakeForm(title: string, description: string): Promise<GoogleForm> {
    const data = await callGoogleApi('https://forms.googleapis.com/v1/forms', {
      method: 'POST',
      body: JSON.stringify({
        info: {
          title,
          documentTitle: title
        }
      })
    });
    return data;
  }
};

// ------------------- Google Chat Service -------------------
export interface ChatSpace {
  name: string;
  displayName: string;
  type: string;
  spaceType?: string;
}

export interface ChatMessage {
  name: string;
  text: string;
  createTime: string;
  sender?: {
    displayName: string;
    type: string;
  };
}

export const chatService = {
  async listSpaces(): Promise<ChatSpace[]> {
    try {
      const data = await callGoogleApi('https://chat.googleapis.com/v1/spaces');
      return data.spaces || [];
    } catch (e: any) {
      console.warn('Chat spaces list warning:', e);
      return [];
    }
  },

  async sendMessage(spaceName: string, text: string): Promise<ChatMessage> {
    return callGoogleApi(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  },

  async createWarRoom(displayName: string): Promise<ChatSpace> {
    return callGoogleApi('https://chat.googleapis.com/v1/spaces', {
      method: 'POST',
      body: JSON.stringify({
        spaceType: 'SPACE',
        displayName
      })
    });
  }
};

// ------------------- Google Sheets Service -------------------
export interface SheetMetadata {
  spreadsheetId: string;
  properties: {
    title: string;
  };
  spreadsheetUrl: string;
}

export const sheetsService = {
  async createSpreadsheet(title: string): Promise<SheetMetadata> {
    return callGoogleApi('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      body: JSON.stringify({
        properties: { title }
      })
    });
  },

  async appendRows(spreadsheetId: string, range: string, values: any[][]) {
    return callGoogleApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        body: JSON.stringify({ values })
      }
    );
  },

  async getValues(spreadsheetId: string, range: string) {
    return callGoogleApi(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`);
  }
};
