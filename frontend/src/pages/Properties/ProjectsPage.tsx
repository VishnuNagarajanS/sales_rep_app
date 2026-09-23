import React, { useState, useEffect } from 'react';
import { MapPin, Grid } from 'lucide-react';
import { PropertyProject } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { StatusChip } from '../../components/common/StatusChip';
import './ProjectsPage.css';

interface ProjectsPageProps {
  onNavigate: (route: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onNavigate }) => {
  const { tenant } = useAuth();
  const [projects, setProjects] = useState<PropertyProject[]>([]);

  useEffect(() => {
    setProjects(storageService.getProjects());
    const handleUpdate = () => setProjects(storageService.getProjects());
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, []);

  return (
    <div className="projects-page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <MapPin size={24} color="#059669" /> Plotted Projects & Communities
          </h1>
          <p className="page-subtitle">
            Master developments, land sanctions, and project-level inventory for {tenant?.name}.
          </p>
        </div>
      </div>

      <div className="projects-grid">
        {projects.map(proj => (
          <div key={proj.id} className="card card-hover project-card">
            <div className="project-header-row">
              <div>
                <h3 className="project-name">{proj.name}</h3>
                <div className="project-location">
                  📍 {proj.location}
                </div>
              </div>
              <StatusChip status={proj.status} size="sm" />
            </div>

            <p className="project-desc">
              {proj.description}
            </p>

            <div className="project-stats-box">
              <div>
                <div className="project-stat-label">Available</div>
                <div className="project-stat-val-avail">{proj.availablePlots}</div>
              </div>
              <div>
                <div className="project-stat-label">On Hold</div>
                <div className="project-stat-val-hold">{proj.holdPlots}</div>
              </div>
              <div>
                <div className="project-stat-label">Sold</div>
                <div className="project-stat-val-sold">{proj.soldPlots}</div>
              </div>
            </div>

            <div className="project-footer-row">
              <span className="project-price-range">
                {proj.priceRange}
              </span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate('plots')}
              >
                <Grid size={13} /> View Layout Grid
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
