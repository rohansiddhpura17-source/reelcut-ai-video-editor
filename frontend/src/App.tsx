import React, { useState, useEffect, useRef } from 'react';
import { ScreenName, ProjectState, ProjectSummary, CaptionSettings, CropSettings, TranscriptSegment, RenderOptions } from './types';
import { api } from './services/api';
import { Header } from './components/layout/Header';
import { UploadVideo } from './pages/UploadVideo';
import { Analysis } from './pages/Analysis';
import { EditPlanPage } from './pages/EditPlan';
import { EditingWorkspace } from './pages/EditingWorkspace';
import { TranscriptEditor } from './pages/TranscriptEditor';
import { CaptionStudio } from './pages/CaptionStudio';
import { CropFraming } from './pages/CropFraming';
import { PreviewPage } from './pages/Preview';
import { ExportStudio } from './pages/Export';

// Initial default empty project state.
// Defaults are neutral: no face is claimed until detection runs, and the
// title card uses the generic backend default text.
const defaultProject: ProjectState = {
  id: 'demo_proj',
  name: 'Viral Video Strategy Reel',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  transcript: [],
  captions: {
    enabled: true,
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 'bold',
    textColor: '#FFFFFF',
    highlightColor: '#14B8A6',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    position: 'bottom',
    yOffsetPercent: 75,
    wordsPerBatch: 4,
    highlightStyle: 'glow',
    showAnimation: true,
  },
  crop: {
    aspectRatio: '9:16',
    mode: 'auto_face',
    xPercent: 50,
    yPercent: 50,
    zoom: 1.0,
    faceDetected: false,
    faceConfidence: 0,
  },
  titleCard: {
    enabled: true,
    title: 'ReelCut Highlight',
    subtitle: 'AI-Assisted Short Edit',
    durationSeconds: 2.0,
    style: 'gradient',
    textColor: '#FFFFFF',
    accentColor: '#14B8A6',
  },
  audio: {
    fadeInSeconds: 0.5,
    fadeOutSeconds: 0.8,
    normalize: true,
    reduceNoise: true,
  },
};

// localStorage key for the last-open project, restored on the next load
// so a page reload no longer loses the current project.
const CURRENT_PROJECT_KEY = 'reelcut.currentProjectId';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('upload');
  const [project, setProject] = useState<ProjectState>(defaultProject);
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [appError, setAppError] = useState<string | null>(null);
  // Undo/redo history for transcript keep/cut and text edits: snapshots of
  // the transcript. The backend recomputes the edit plan on restore.
  const [undoStack, setUndoStack] = useState<TranscriptSegment[][]>([]);
  const [redoStack, setRedoStack] = useState<TranscriptSegment[][]>([]);
  // Guards the mount effect against React StrictMode's double-invoke in
  // dev (which used to create two empty projects per page load).
  const initRef = useRef(false);

  const refreshRecents = async () => {
    try {
      setRecentProjects(await api.listProjects());
    } catch {
      setRecentProjects([]);
    }
  };

  // Initialize: restore the last-open project from localStorage, or
  // create a new one when there is none (or the stored one is gone).
  // A failed restore falls back to a new project, never a blank screen.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const init = async () => {
      const storedId = localStorage.getItem(CURRENT_PROJECT_KEY);
      if (storedId) {
        try {
          const proj = await api.getProject(storedId);
          setProject(proj);
          refreshRecents();
          return;
        } catch {
          localStorage.removeItem(CURRENT_PROJECT_KEY);
        }
      }
      try {
        const proj = await api.createProject('Viral Video Strategy Reel');
        localStorage.setItem(CURRENT_PROJECT_KEY, proj.id);
        setProject(proj);
      } catch (err) {
        console.log('Using local client state:', err);
        setAppError('Could not reach the backend. Start it with: cd backend; source venv/bin/activate; uvicorn app.main:app --host 127.0.0.1 --port 8000');
      }
      refreshRecents();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember the current project so the next page load restores it.
  useEffect(() => {
    if (project.id && project.id !== 'demo_proj') {
      localStorage.setItem(CURRENT_PROJECT_KEY, project.id);
    }
  }, [project.id]);

  // Open an existing project from the recent list.
  const handleOpenProject = async (projectId: string) => {
    setAppError(null);
    try {
      const proj = await api.getProject(projectId);
      setProject(proj);
      setUndoStack([]);
      setRedoStack([]);
      setCurrentScreen(proj.metadata ? 'analysis' : 'upload');
    } catch (e) {
      setAppError(`Could not open that project: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  // Explicit "New project" action: creates a fresh empty project.
  const handleNewProject = async () => {
    setAppError(null);
    try {
      const proj = await api.createProject('Viral Video Strategy Reel');
      localStorage.setItem(CURRENT_PROJECT_KEY, proj.id);
      setProject(proj);
      setUndoStack([]);
      setRedoStack([]);
      setCurrentScreen('upload');
      refreshRecents();
    } catch (e) {
      setAppError(`Could not create a project: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  // Video upload handler. No mock fallback: a failed upload is reported.
  const handleVideoUploaded = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(10);
    setAppError(null);
    try {
      const updated = await api.uploadVideo(project.id, file, (pct) => {
        setUploadProgress(pct);
      });
      setProject(updated);
      setUndoStack([]);
      setRedoStack([]);
      setIsUploading(false);
      refreshRecents();
      setCurrentScreen('analysis');
      // Trigger analysis immediately
      handleRunAnalysis(updated.id);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setAppError(`Upload failed: ${err instanceof Error ? err.message : 'unknown error'}. Check the backend is running on port 8000.`);
    }
  };

  // Run backend analysis. No mock fallback: a failed analysis is reported.
  const handleRunAnalysis = async (projectId: string) => {
    setIsAnalyzing(true);
    setAppError(null);
    try {
      const updated = await api.runAnalysis(projectId);
      setProject(updated);
      if (updated.analysis && updated.analysis.transcriptionAvailable === false) {
        setAppError('Speech recognition was unavailable for this video, so the transcript is empty. Silence cuts were still detected.');
      }
    } catch (e) {
      console.warn('Backend analysis failed:', e);
      setAppError(`Analysis failed: ${e instanceof Error ? e.message : 'unknown error'}.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Edit plan actions. The backend recomputes retained intervals and the
  // estimated final duration; the returned project is the source of truth,
  // so Approve All and single toggles always agree with the server.
  const handleUpdateSuggestion = async (id: string, decision: 'cut' | 'keep', approved: boolean) => {
    if (!project.editPlan) return;
    const updatedSuggestions = project.editPlan.suggestions.map((s) =>
      s.id === id ? { ...s, decision, approved } : s
    );
    const updatedPlan = {
      ...project.editPlan,
      suggestions: updatedSuggestions,
    };
    try {
      const updated = await api.updateEditPlan(project.id, updatedPlan);
      setProject(updated);
    } catch (e) {
      setAppError(`Could not save that change: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const handleApproveAll = async () => {
    if (!project.editPlan) return;
    const updatedSuggestions = project.editPlan.suggestions.map((s) => ({
      ...s,
      decision: 'cut' as const,
      approved: true,
    }));
    const updatedPlan = {
      ...project.editPlan,
      suggestions: updatedSuggestions,
    };
    try {
      const updated = await api.updateEditPlan(project.id, updatedPlan);
      setProject(updated);
    } catch (e) {
      setAppError(`Could not approve all cuts: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const pushTranscriptHistory = (current: TranscriptSegment[]) => {
    setUndoStack((prev) => [...prev.slice(-49), current]);
    setRedoStack([]);
  };

  // Toggle segment keep
  const handleToggleSegmentKeep = async (segmentId: string) => {
    pushTranscriptHistory(project.transcript);
    const updated = project.transcript.map((s) =>
      s.id === segmentId ? { ...s, isKept: !s.isKept } : s
    );
    try {
      const res = await api.updateTranscript(project.id, updated);
      setProject(res);
    } catch (e) {
      setUndoStack((prev) => prev.slice(0, -1));
      setAppError(`Could not save that change: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  // Transcript edits from the Transcript Editor (keep toggles + text edits)
  const handleUpdateTranscript = async (updated: TranscriptSegment[]) => {
    pushTranscriptHistory(project.transcript);
    try {
      const res = await api.updateTranscript(project.id, updated);
      setProject(res);
    } catch (e) {
      setUndoStack((prev) => prev.slice(0, -1));
      setAppError(`Could not save the transcript: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, project.transcript]);
    try {
      const res = await api.updateTranscript(project.id, prev);
      setProject(res);
    } catch (e) {
      setAppError(`Undo failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, project.transcript]);
    try {
      const res = await api.updateTranscript(project.id, next);
      setProject(res);
    } catch (e) {
      setAppError(`Redo failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  // Update captions
  const handleUpdateCaptions = (captions: CaptionSettings) => {
    setProject((prev) => ({ ...prev, captions }));
    api.updateSettings(project.id, { captions }).catch((e) =>
      setAppError(`Could not save caption settings: ${e instanceof Error ? e.message : 'unknown error'}`)
    );
  };

  // Update crop
  const handleUpdateCrop = (crop: CropSettings) => {
    setProject((prev) => ({ ...prev, crop }));
    api.updateSettings(project.id, { crop }).catch((e) =>
      setAppError(`Could not save crop settings: ${e instanceof Error ? e.message : 'unknown error'}`)
    );
  };

  // Run face detection. Returns the detected crop (or throws); no fake
  // fallback values are applied on failure.
  const handleDetectFace = async (): Promise<CropSettings | null> => {
    try {
      const res = await api.detectFaces(project.id);
      setProject((prev) => ({ ...prev, crop: res }));
      return res;
    } catch (e) {
      const msg = `Face detection failed: ${e instanceof Error ? e.message : 'unknown error'}`;
      setAppError(msg);
      throw new Error(msg);
    }
  };

  // Start FFmpeg render with the Export page options. No simulated render:
  // if the backend cannot start it, the failure is reported.
  const handleStartRender = async (options?: RenderOptions) => {
    setIsRendering(true);
    setAppError(null);
    try {
      const job = await api.startRender(project.id, options);
      setProject((prev) => ({ ...prev, renderJob: job }));

      // Poll status
      const interval = setInterval(async () => {
        try {
          const status = await api.getRenderStatus(project.id, job.jobId);
          setProject((prev) => ({ ...prev, renderJob: status }));
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(interval);
            setIsRendering(false);
            if (status.status === 'failed') {
              setAppError(`Render failed: ${status.error || 'unknown error'}`);
            }
          }
        } catch {
          clearInterval(interval);
          setIsRendering(false);
        }
      }, 1000);
    } catch (err) {
      console.warn('Render failed to start:', err);
      setIsRendering(false);
      setProject((prev) => ({
        ...prev,
        renderJob: {
          jobId: 'failed',
          status: 'failed',
          progressPercent: 0,
          currentStep: 'Render failed to start',
          error: err instanceof Error ? err.message : 'unknown error',
        },
      }));
      setAppError(`Render failed to start: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090D16] text-slate-100 font-sans">
      {/* Top Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        projectName={project.name}
        originalDuration={project.metadata?.duration}
        finalDuration={project.editPlan?.estimatedFinalDuration}
        hasVideo={!!project.metadata}
      />

      {/* Error banner: backend failures are shown, never silently faked */}
      {appError && (
        <div className="flex items-start justify-between gap-3 px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 text-rose-200 text-xs shrink-0">
          <span>{appError}</span>
          <button
            onClick={() => setAppError(null)}
            className="text-rose-300 hover:text-white font-semibold whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Screen Router */}
      <main className="flex-1 flex overflow-hidden">
        {currentScreen === 'upload' && (
          <UploadVideo
            project={project}
            onVideoUploaded={handleVideoUploaded}
            onStartAnalysis={() => {
              setCurrentScreen('analysis');
              handleRunAnalysis(project.id);
            }}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            recentProjects={recentProjects}
            onOpenProject={handleOpenProject}
            onNewProject={handleNewProject}
          />
        )}

        {currentScreen === 'analysis' && (
          <Analysis
            project={project}
            isAnalyzing={isAnalyzing}
            onProceedToPlan={() => setCurrentScreen('edit_plan')}
            onReanalyze={() => handleRunAnalysis(project.id)}
          />
        )}

        {currentScreen === 'edit_plan' && (
          <EditPlanPage
            project={project}
            onUpdateSuggestion={handleUpdateSuggestion}
            onApproveAll={handleApproveAll}
            onProceedToWorkspace={() => setCurrentScreen('workspace')}
          />
        )}

        {currentScreen === 'workspace' && (
          <EditingWorkspace
            project={project}
            onNavigate={(screen) => setCurrentScreen(screen)}
            onToggleSegmentKeep={handleToggleSegmentKeep}
            onUpdateSuggestion={handleUpdateSuggestion}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
          />
        )}

        {currentScreen === 'transcript' && (
          <TranscriptEditor
            project={project}
            onUpdateTranscript={handleUpdateTranscript}
            onNavigateToWorkspace={() => setCurrentScreen('workspace')}
          />
        )}

        {currentScreen === 'captions' && (
          <CaptionStudio
            project={project}
            onUpdateCaptions={handleUpdateCaptions}
            onNavigateToWorkspace={() => setCurrentScreen('workspace')}
          />
        )}

        {currentScreen === 'crop' && (
          <CropFraming
            project={project}
            onUpdateCrop={handleUpdateCrop}
            onDetectFace={handleDetectFace}
            onNavigateToWorkspace={() => setCurrentScreen('workspace')}
          />
        )}

        {currentScreen === 'preview' && (
          <PreviewPage
            project={project}
            onNavigate={(screen) => setCurrentScreen(screen)}
            onStartRender={handleStartRender}
          />
        )}

        {currentScreen === 'export' && (
          <ExportStudio
            project={project}
            onStartRender={handleStartRender}
            isRendering={isRendering}
            renderJob={project.renderJob}
          />
        )}
      </main>
    </div>
  );
};

export default App;
