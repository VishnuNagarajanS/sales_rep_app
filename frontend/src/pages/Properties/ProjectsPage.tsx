import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Grid, RefreshCw, Calendar, CheckCircle2, Plus, Upload, Image as ImageIcon, X, Edit3, Trash2, AlertTriangle, Map, Maximize2, ZoomIn, ZoomOut, RotateCcw, MoreVertical } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { jaminApiService } from '../../services/jaminApiService';
import './ProjectsPage.css';

interface ProjectsPageProps {
  onNavigate: (route: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onNavigate }) => {
  const { tenant, user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [viewingBlueprintProject, setViewingBlueprintProject] = useState<any | null>(null);
  const [blueprintZoom, setBlueprintZoom] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<number | string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State (Add / Edit)
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('Active');
  const [totalPlots, setTotalPlots] = useState<number>(20);
  const [priceRange, setPriceRange] = useState('₹35 L – ₹80 L');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit. Please choose a smaller image.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await jaminApiService.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects from backend', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
    const handleClickOutside = () => setActiveDropdownId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const openAddModal = () => {
    setName('');
    setLocation('');
    setStatus('Active');
    setDescription('');
    setImageUrl('');
    setTotalPlots(20);
    setPriceRange('₹35 L – ₹80 L');
    setIsAddModalOpen(true);
  };

  const openEditModal = (proj: any) => {
    setSelectedProject(proj);
    setName(proj.name || '');
    setLocation(proj.location || '');
    setStatus(proj.status || 'Active');
    setTotalPlots(proj.totalPlots || 20);
    setPriceRange(proj.priceRange || '');
    setDescription(proj.description || '');
    setImageUrl(proj.imageUrl || '');
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (proj: any) => {
    setSelectedProject(proj);
    setIsDeleteModalOpen(true);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      alert('Project Name and Location are required.');
      return;
    }

    setSubmitting(true);
    try {
      const success = await jaminApiService.createProject({
        name: name.trim(),
        location: location.trim(),
        totalPlots: Number(totalPlots) || 0,
        priceRange: priceRange.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || undefined,
        status: status || 'Active',
      });

      if (success) {
        setIsAddModalOpen(false);
        await loadProjects();
      } else {
        alert('Failed to create project in database. Ensure you are logged in with admin privileges.');
      }
    } catch (err) {
      console.error('Error creating project', err);
      alert('Error creating project on backend.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !name.trim() || !location.trim()) {
      alert('Project Name and Location are required.');
      return;
    }

    setSubmitting(true);
    try {
      const success = await jaminApiService.updateProject(selectedProject.id, {
        name: name.trim(),
        location: location.trim(),
        status: status.trim(),
        totalPlots: Number(totalPlots) || 0,
        priceRange: priceRange.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || '',
      });

      if (success) {
        setIsEditModalOpen(false);
        setSelectedProject(null);
        await loadProjects();
      } else {
        alert('Failed to update project. Please verify inputs.');
      }
    } catch (err) {
      console.error('Error updating project', err);
      alert('Error updating project on backend.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    setSubmitting(true);
    try {
      const success = await jaminApiService.deleteProject(selectedProject.id);
      if (success) {
        setIsDeleteModalOpen(false);
        setSelectedProject(null);
        await loadProjects();
      } else {
        alert('Failed to delete project. Ensure no conflicting records lock this project.');
      }
    } catch (err) {
      console.error('Error deleting project', err);
      alert('Error deleting project from backend.');
    } finally {
      setSubmitting(false);
    }
  };

  const getProjectImage = (proj: any) => {
    if (proj?.imageUrl && proj.imageUrl.trim() !== '') return proj.imageUrl;
    return '';
  };

  const canManageProjects = user?.role?.code === 'company_admin' || user?.role?.code === 'super_admin';

  return (
    <div className="projects-page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">
            <MapPin size={24} color="#059669" /> Plotted Projects & Communities
          </h1>
          <p className="page-subtitle">
            Master developments, land sanctions, and live project-level inventory from backend database.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadProjects}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {canManageProjects && (
            <button
              className="btn btn-primary"
              onClick={openAddModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Add New Project
            </button>
          )}
        </div>
      </div>

      {loading && projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
          Loading projects from backend database...
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '16px' }}>No projects found in the backend database.</p>
          {canManageProjects && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={16} /> Create First Project
            </button>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(proj => {
            const hasImage = Boolean(proj.imageUrl && proj.imageUrl.trim() !== '');

            return (
              <div key={proj.id} className="card card-hover project-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="project-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 className="project-name" style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>{proj.name}</h3>
                      <StatusChip status={proj.status || 'Active'} size="sm" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#64748b', fontSize: '0.875rem' }}>
                      <MapPin size={14} color="#059669" />
                      <span>{proj.location}</span>
                    </div>
                  </div>
                  {canManageProjects && (
                    <div style={{ position: 'relative' }}>
                      <button
                        className="btn-icon"
                        title="Project Options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownId(prev => (prev === proj.id ? null : proj.id));
                        }}
                        style={{
                          padding: '6px',
                          background: activeDropdownId === proj.id ? '#f1f5f9' : 'transparent',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                        onMouseLeave={(e) => {
                          if (activeDropdownId !== proj.id) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {activeDropdownId === proj.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: 0,
                            background: '#ffffff',
                            borderRadius: '8px',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                            border: '1px solid #e2e8f0',
                            minWidth: '150px',
                            zIndex: 50,
                            overflow: 'hidden',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDropdownId(null);
                              openEditModal(proj);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <Edit3 size={14} color="#0284c7" /> Edit Project
                          </button>

                          <div style={{ height: '1px', background: '#f1f5f9', margin: '0' }} />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveDropdownId(null);
                              openDeleteModal(proj);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              color: '#dc2626',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <Trash2 size={14} color="#dc2626" /> Delete Project
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {proj.description && (
                  <p className="project-desc" style={{ margin: 0 }}>
                    {proj.description}
                  </p>
                )}

                  <div className="project-stats-box" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <div>
                      <div className="project-stat-label">Total</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#334155' }}>{proj.totalPlots || 0}</div>
                    </div>
                    <div>
                      <div className="project-stat-label">Available</div>
                      <div className="project-stat-val-avail">{proj.availablePlots || 0}</div>
                    </div>
                    <div>
                      <div className="project-stat-label">On Hold</div>
                      <div className="project-stat-val-hold">{proj.heldPlots ?? proj.holdPlots ?? 0}</div>
                    </div>
                    <div>
                      <div className="project-stat-label">Booked/Sold</div>
                      <div className="project-stat-val-sold">{proj.bookedPlots ?? proj.soldPlots ?? 0}</div>
                    </div>
                  </div>

                  {/* Live visits & bookings summary */}
                  <div style={{ display: 'flex', gap: '16px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem', color: '#475569' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} color="#0284c7" /> <strong>{proj.totalSiteVisits || 0}</strong> Site Visits
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={13} color="#16a34a" /> <strong>{proj.totalBookings || 0}</strong> Bookings
                    </span>
                  </div>

                  <div className="project-footer-row" style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="project-price-range" style={{ fontSize: '0.95rem', fontWeight: 700, color: '#059669' }}>
                      {proj.priceRange || 'Contact for pricing'}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setBlueprintZoom(1); setViewingBlueprintProject(proj); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 600 }}
                        title="View Master Layout Blueprint"
                      >
                        <Map size={14} /> Master Layout
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onNavigate('plots')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Grid size={14} /> Plot Grid
                      </button>
                    </div>
                  </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Project Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Launch New Plotted Project / Community"
        subtitle="Create a master land development record directly in the backend database"
      >
        <form onSubmit={handleCreateProject}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input
                type="text"
                className="form-input"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Jamin Signature Enclave Phase 1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Location / Landmark *</label>
              <input
                type="text"
                className="form-input"
                required
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Sarjapur-Attibele Road, Bengaluru, Karnataka"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Total Planned Plots *</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  min={1}
                  value={totalPlots}
                  onChange={e => setTotalPlots(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Price Range</label>
                <input
                  type="text"
                  className="form-input"
                  value={priceRange}
                  onChange={e => setPriceRange(e.target.value)}
                  placeholder="e.g. ₹40 L – ₹95 L"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Master Layout Blueprint / Site Plan (Stored in Database)</label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              {imageUrl ? (
                <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', marginBottom: '8px' }}>
                  <img
                    src={imageUrl}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#f8fafc',
                    transition: 'all 0.2s ease',
                    marginBottom: '8px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#059669')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
                >
                  <Upload size={24} color="#059669" style={{ margin: '0 auto 8px auto' }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                    Click to browse or drop layout image
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    PNG, JPG, WEBP up to 5MB (Stores directly into database)
                  </div>
                </div>
              )}

              <input
                type="text"
                className="form-input"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="Or paste image URL (https://...)"
                style={{ fontSize: '0.8rem' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Project Description & Sanctions</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. BMRDA / DTCP approved layout with 40ft main roads, clubhouse, and underground power."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Project Status</label>
              <select
                className="form-select"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating in Database...' : 'Create Project'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedProject(null); }}
        title="Edit Plotted Project / Community"
        subtitle={`Update project details for "${selectedProject?.name || ''}"`}
      >
        <form onSubmit={handleUpdateProject}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input
                type="text"
                className="form-input"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Jamin Signature Enclave Phase 1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Location / Landmark *</label>
              <input
                type="text"
                className="form-input"
                required
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Sarjapur-Attibele Road, Bengaluru, Karnataka"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Total Plots</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  value={totalPlots}
                  onChange={e => setTotalPlots(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Price Range</label>
                <input
                  type="text"
                  className="form-input"
                  value={priceRange}
                  onChange={e => setPriceRange(e.target.value)}
                  placeholder="e.g. ₹40 L – ₹95 L"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Project Status</label>
              <select
                className="form-select"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Master Layout Blueprint / Site Plan (Stored in Database)</label>
              <input
                type="file"
                ref={editFileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleFileUpload(e, true)}
              />

              {imageUrl ? (
                <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', marginBottom: '8px' }}>
                  <img
                    src={imageUrl}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => editFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#f8fafc',
                    marginBottom: '8px',
                  }}
                >
                  <Upload size={20} color="#059669" style={{ margin: '0 auto 6px auto' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                    Click to browse or replace layout image
                  </div>
                </div>
              )}

              <input
                type="text"
                className="form-input"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="Or paste image URL (https://...)"
                style={{ fontSize: '0.8rem' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Project Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description of this project layout."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setIsEditModalOpen(false); setSelectedProject(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Project Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setSelectedProject(null); }}
        title="Delete Plotted Project"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
            <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.9rem' }}>
              Are you sure you want to delete <strong>"{selectedProject?.name}"</strong>? This will remove this project and its associated plots from the database.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setIsDeleteModalOpen(false); setSelectedProject(null); }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              onClick={handleDeleteProject}
              disabled={submitting}
            >
              {submitting ? 'Deleting...' : 'Delete Project'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Master Layout Blueprint Modal */}
      <Modal
        isOpen={!!viewingBlueprintProject}
        onClose={() => setViewingBlueprintProject(null)}
        title={`${viewingBlueprintProject?.name || 'Project'} — Gated Community Master Layout Blueprint`}
        subtitle={`Master layout diagram, land sanctions, and overall community plan for ${viewingBlueprintProject?.location || ''}`}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Zoom Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: '#475569' }}>
              <span>Zoom: <strong>{Math.round(blueprintZoom * 100)}%</strong></span>
              <span>•</span>
              <span>Total Plots: <strong>{viewingBlueprintProject?.totalPlots || 0}</strong></span>
              <span>•</span>
              <span style={{ color: '#059669', fontWeight: 600 }}>{viewingBlueprintProject?.availablePlots || 0} Available</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setBlueprintZoom(prev => Math.max(0.75, prev - 0.25))}
                disabled={blueprintZoom <= 0.75}
                title="Zoom Out"
                style={{ padding: '4px 10px' }}
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setBlueprintZoom(1)}
                title="Reset Zoom"
                style={{ padding: '4px 10px' }}
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setBlueprintZoom(prev => Math.min(2.5, prev + 0.25))}
                disabled={blueprintZoom >= 2.5}
                title="Zoom In"
                style={{ padding: '4px 10px' }}
              >
                <ZoomIn size={15} />
              </button>
            </div>
          </div>

          {/* Blueprint Canvas */}
          <div style={{
            width: '100%',
            height: '520px',
            overflow: 'auto',
            background: '#0f172a',
            borderRadius: '10px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #334155',
          }}>
            {viewingBlueprintProject?.imageUrl ? (
              <img
                src={viewingBlueprintProject.imageUrl}
                alt={`${viewingBlueprintProject.name} Master Layout Blueprint`}
                style={{
                  transform: `scale(${blueprintZoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px' }}>
                <ImageIcon size={48} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                <p style={{ fontSize: '1rem', color: '#cbd5e1', margin: '0 0 8px 0' }}>
                  No Master Layout Blueprint uploaded for this project.
                </p>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px 0' }}>
                  You can upload the community blueprint or sanction map into the database anytime.
                </p>
                {canManageProjects && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const p = viewingBlueprintProject;
                      setViewingBlueprintProject(null);
                      openEditModal(p);
                    }}
                  >
                    <Edit3 size={14} /> Upload Blueprint Now
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
