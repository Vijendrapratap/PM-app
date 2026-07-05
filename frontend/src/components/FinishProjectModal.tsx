import { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { AxiosError } from 'axios';
import { projectApi } from '../api/projectApi';
import type { Project } from '../types';

type Step = 1 | 2 | 3;

const FinishProjectModal = ({
  project,
  onClose,
  onSuccess,
}: {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [finalData, setFinalData] = useState({ github: '', googleDrive: '', liveWebsite: '', finalNotes: '' });

  const handleValidate = async () => {
    setLoading(true);
    setErrors([]);
    try {
      await projectApi.validateCompletion(project._id);
      setStep(3);
    } catch (err) {
      const responseErrors = (err as AxiosError<{ errors?: string[] }>).response?.data?.errors;
      setErrors(responseErrors ?? ['An unexpected error occurred. Please try again.']);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await projectApi.finish(project._id, finalData);
      onSuccess();
    } catch {
      alert('Failed to finish project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {step === 1 && 'Finish Project'}
              {step === 2 && 'Validation Failed'}
              {step === 3 && 'Final Confirmation'}
            </div>
            <div className="modal-subtitle">
              {step === 1 && `"${project.name}"`}
              {step === 2 && 'Fix these issues before completing.'}
              {step === 3 && 'This action cannot be undone.'}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {step === 1 && (
          <>
            <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: 'rgba(245,158,11,0.12)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <AlertTriangle size={26} style={{ color: 'var(--warning)' }} />
              </div>
              <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Are you sure you want to finish this project?
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                We'll first validate all requirements are met. If passed, you'll confirm and the project will become read-only.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>Continue Working</button>
              <button className="btn btn-primary" onClick={handleValidate} disabled={loading}>
                {loading ? 'Validating...' : 'Continue to Finish'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 600, color: '#f87171', fontSize: '0.875rem' }}>
                  <XCircle size={16} /> Validation Errors ({errors.length})
                </div>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {errors.map((err, i) => (
                    <li key={i} style={{ fontSize: '0.8125rem', color: '#fca5a5' }}>{err}</li>
                  ))}
                </ul>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Please fix the issues above and try finishing the project again.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>Back to Project</button>
              <button className="btn btn-secondary" onClick={() => { setStep(1); setErrors([]); }}>Try Again</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '0.125rem' }} />
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#34d399' }}>All validations passed!</p>
                  <p style={{ fontSize: '0.8125rem', color: 'rgba(52,211,153,0.7)', marginTop: '0.25rem' }}>
                    After completion, this project will be locked and moved to the Completed Projects archive.
                  </p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Final GitHub Repository (Optional)</label>
                <input type="url" className="form-input" placeholder="https://github.com/..." value={finalData.github} onChange={e => setFinalData({ ...finalData, github: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Final Live URL (Optional)</label>
                <input type="url" className="form-input" placeholder="https://..." value={finalData.liveWebsite} onChange={e => setFinalData({ ...finalData, liveWebsite: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Final Notes</label>
                <textarea className="form-textarea" rows={3} placeholder="Completion notes, handoff instructions..." value={finalData.finalNotes} onChange={e => setFinalData({ ...finalData, finalNotes: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-success" onClick={handleFinish} disabled={loading}>
                <CheckCircle2 size={15} />
                {loading ? 'Completing...' : 'Mark as Completed'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FinishProjectModal;
