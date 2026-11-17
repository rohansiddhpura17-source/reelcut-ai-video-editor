import {
  ProjectState,
  ProjectSummary,
  EditPlan,
  TranscriptSegment,
  CaptionSettings,
  CropSettings,
  TitleCardSettings,
  AudioSettings,
  RenderJob,
  RenderOptions,
} from '../types';

// API base path - defaults to relative /api when proxied or same-origin
const API_BASE = '/api';

export const api = {
  async createProject(name?: string): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || 'Untitled Reel' }),
    });
    if (!res.ok) throw new Error(`Failed to create project: ${res.statusText}`);
    return res.json();
  },

  async getProject(projectId: string): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/projects/${projectId}`);
    if (!res.ok) throw new Error(`Failed to load project: ${res.statusText}`);
    return res.json();
  },

  async listProjects(): Promise<ProjectSummary[]> {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error(`Failed to list projects: ${res.statusText}`);
    return res.json();
  },

  async uploadVideo(
    projectId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ProjectState> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('video', file);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (err) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during video upload'));
      });

      xhr.open('POST', `${API_BASE}/projects/${projectId}/upload`);
      xhr.send(formData);
    });
  },

  async runAnalysis(projectId: string): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/analyze`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Analysis failed: ${res.statusText}`);
    return res.json();
  },

  async generateEditPlan(projectId: string): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/edit-plan`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Edit plan generation failed: ${res.statusText}`);
    return res.json();
  },

  async updateEditPlan(projectId: string, editPlan: EditPlan): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/edit-plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editPlan),
    });
    if (!res.ok) throw new Error(`Failed to update edit plan: ${res.statusText}`);
    return res.json();
  },

  async updateTranscript(
    projectId: string,
    transcript: TranscriptSegment[]
  ): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/transcript`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) throw new Error(`Failed to update transcript: ${res.statusText}`);
    return res.json();
  },

  async updateSettings(
    projectId: string,
    settings: {
      captions?: CaptionSettings;
      crop?: CropSettings;
      titleCard?: TitleCardSettings;
      audio?: AudioSettings;
    }
  ): Promise<ProjectState> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`Failed to update settings: ${res.statusText}`);
    return res.json();
  },

  async detectFaces(projectId: string): Promise<CropSettings> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/detect-face`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Face detection failed: ${res.statusText}`);
    return res.json();
  },

  async startRender(projectId: string, options?: RenderOptions): Promise<RenderJob> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: options ? JSON.stringify(options) : undefined,
    });
    if (!res.ok) throw new Error(`Render failed to start: ${res.statusText}`);
    return res.json();
  },

  async getRenderStatus(projectId: string, jobId: string): Promise<RenderJob> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/render/${jobId}`);
    if (!res.ok) throw new Error(`Failed to check render status: ${res.statusText}`);
    return res.json();
  },
};
