// Data Management Module
// Handles all data operations including authentication, teams, agents, audits, and metrics

// Safe storage fallback so the app still works if localStorage is blocked (e.g. some Vercel previews)
const SafeStorage = (() => {
  const memoryStore = {};
  const memoryStorage = {
    getItem: (key) => (key in memoryStore ? memoryStore[key] : null),
    setItem: (key, value) => {
      memoryStore[key] = value;
    },
    removeItem: (key) => {
      delete memoryStore[key];
    }
  };

  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, 'ok');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (err) {
    console.warn('localStorage no disponible, usando almacenamiento en memoria', err);
    return memoryStorage;
  }
})();

// Expose for other scripts (app.js)
window.SafeStorage = SafeStorage;

const DataManager = {
  // Storage keys
  STORAGE_KEYS: {
    USER: 'calidad_user',
    AUDITS: 'calidad_audits',
    TEAMS: 'calidad_teams',
    METRICS: 'calidad_metrics',
    WEEKLY_METRICS: 'calidad_weekly_metrics',
    WEEK_CONFIG: 'calidad_week_config',
    AUDIT_VIEWS: 'calidad_audit_views',
    AUDIT_COMMENTS: 'calidad_audit_comments',
    ACTIVITY_LOG: 'calidad_activity_log',
    CONNECTION_HOURS: 'calidad_connection_hours'
  },

  // Remove all persisted app data so every load starts clean
  resetStorage() {
    Object.values(this.STORAGE_KEYS).forEach(key => SafeStorage.removeItem(key));
  },

  // Team definitions
  TEAMS: [
    { id: 'soporte-usuarios', name: 'Soporte Usuarios', color: '#38CEA6', email: 'soporte.usuarios@ridery.com' },
    { id: 'soporte-conductores', name: 'Soporte Conductores', color: '#06b6d4', email: 'soporte.conductores@ridery.com' },
    { id: 'soporte-ecr', name: 'Soporte de ECR', color: '#a855f7', email: 'soporte.ecr@ridery.com' },
    { id: 'soporte-corporativo', name: 'Soporte de Corporativo', color: '#f59e0b', email: 'soporte.corporativo@ridery.com' },
    { id: 'soporte-delivery', name: 'Soporte de Delivery Zupper', color: '#ef4444', email: 'soporte.delivery@ridery.com' }
  ],

  // Default agents (Complete team examples with all shifts)
  DEFAULT_AGENTS: {
    'soporte-usuarios': [],
    'soporte-conductores': [
      { name: 'Adriana Rojas', email: 'adriana.rojas@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Nicole Serrano', email: 'nicole.serrano@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Maryolis Castillo', email: 'maryolis.castillo@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Yale', email: 'yale@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Saroaly Torres', email: 'saroaly.torres@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'María Serrano', email: 'maria.serrano@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Roibert Arteaga', email: 'roibert.arteaga@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Abraham Brito', email: 'abraham.brito@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Luzwaldo Sanz', email: 'luzwaldo.sanz@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Naygreth Darias', email: 'naygreth.darias@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Ignacio Queremel', email: 'ignacio.queremel@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Andrea Viadero', email: 'andrea.viadero@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Miguel Corena', email: 'miguel.corena@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Glorian Sierra', email: 'glorian.sierra@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Kevin', email: 'kevin@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Olga Fonseca', email: 'olga.fonseca@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Gabriel Codallo', email: 'gabriel.codallo@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Luz Aguilar', email: 'luz.aguilar@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Gianpiero Villalba', email: 'gianpiero.villalba@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Francis Serrano', email: 'francis.serrano@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Elizabeth Rodríguez', email: 'elizabeth.rodriguez@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Sara Villegas', email: 'sara.villegas@ridery.com', team: 'soporte-conductores', shift: 'AM' },
      { name: 'Tiffany Urbina', email: 'tiffany.urbina@ridery.com', team: 'soporte-conductores', shift: 'AM' }
    ],
    'soporte-ecr': [],
    'soporte-corporativo': [],
    'soporte-delivery': []
  },

  // Test accounts with roles
  // Roles: 'admin', 'calidad' (formerly editor), 'supervisor', 'analista', 'viewer'
  TEST_ACCOUNTS: {
    'admin@ridery.com': { email: 'admin@ridery.com', role: 'admin' },
    'calidad@ridery.com': { email: 'calidad@ridery.com', role: 'calidad' },
    'editor@ridery.com': { email: 'editor@ridery.com', role: 'calidad' }, // Legacy support
    // Supervisor accounts (one per team)
    'supervisor.usuarios@ridery.com': { email: 'supervisor.usuarios@ridery.com', role: 'supervisor', team: 'soporte-usuarios' },
    'supervisor.conductores@ridery.com': { email: 'supervisor.conductores@ridery.com', role: 'supervisor', team: 'soporte-conductores' },
    'supervisor.ecr@ridery.com': { email: 'supervisor.ecr@ridery.com', role: 'supervisor', team: 'soporte-ecr' },
    'supervisor.corporativo@ridery.com': { email: 'supervisor.corporativo@ridery.com', role: 'supervisor', team: 'soporte-corporativo' },
    'supervisor.delivery@ridery.com': { email: 'supervisor.delivery@ridery.com', role: 'supervisor', team: 'soporte-delivery' },
    // Analista account
    'analista@ridery.com': { email: 'analista@ridery.com', role: 'analista', team: 'soporte-usuarios' },
    // User test accounts
    'usuario.prueba@ridery.com': { email: 'usuario.prueba@ridery.com', role: 'viewer', team: 'soporte-usuarios' },
    'usuario.conductores@ridery.com': { email: 'usuario.conductores@ridery.com', role: 'viewer', team: 'soporte-conductores' }
  },

  // Initialize data (non-destructive; only seeds missing stores)
  // Inicializa SIEMPRE los datos de prueba y equipos en cada arranque (no solo si faltan)
  init() {
    SafeStorage.setItem(this.STORAGE_KEYS.AUDITS, JSON.stringify([]));
    const teamsData = {};
    this.TEAMS.forEach(team => {
      teamsData[team.id] = {
        ...team,
        members: this.DEFAULT_AGENTS[team.id] || []
      };
    });
    SafeStorage.setItem(this.STORAGE_KEYS.TEAMS, JSON.stringify(teamsData));
    SafeStorage.setItem(this.STORAGE_KEYS.METRICS, JSON.stringify({}));
    SafeStorage.setItem(this.STORAGE_KEYS.WEEKLY_METRICS, JSON.stringify({}));
    // Configuración de semanas por defecto (enero 2026)
    const defaultConfig = {
      '2026-0': [
        { weekNumber: 1, startDate: '2026-01-05', endDate: '2026-01-11', label: 'Semana 1: 05/01 al 11/01' },
        { weekNumber: 2, startDate: '2026-01-12', endDate: '2026-01-18', label: 'Semana 2: 12/01 al 18/01' },
        { weekNumber: 3, startDate: '2026-01-19', endDate: '2026-01-25', label: 'Semana 3: 19/01 al 25/01' },
        { weekNumber: 4, startDate: '2026-01-26', endDate: '2026-02-01', label: 'Semana 4: 26/01 al 01/02' }
      ]
    };
    SafeStorage.setItem(this.STORAGE_KEYS.WEEK_CONFIG, JSON.stringify(defaultConfig));
    SafeStorage.setItem(this.STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify([]));
    SafeStorage.setItem(this.STORAGE_KEYS.CONNECTION_HOURS, JSON.stringify({}));
  },

  // Teams management
  getAllTeams() {
    const teamsStr = SafeStorage.getItem(this.STORAGE_KEYS.TEAMS);
    return teamsStr ? JSON.parse(teamsStr) : {};
  },

  getTeamById(teamId) {
    const teams = this.getAllTeams();
    return teams[teamId] || null;
  },

  getAllAgents() {
    const teams = this.getAllTeams();
    const agents = [];
    Object.values(teams).forEach(team => {
      team.members.forEach(member => {
        agents.push({ ...member, teamName: team.name, teamColor: team.color });
      });
    });
    return agents;
  },

  addTeamMember(teamId, memberData, addedBy = null, addedByRole = null) {
    const teams = this.getAllTeams();
    if (teams[teamId]) {
      teams[teamId].members.push({
        ...memberData,
        team: teamId,
        subTeam: memberData.subTeam || null,
        addedAt: new Date().toISOString(),
        addedBy: addedBy
      });
      SafeStorage.setItem(this.STORAGE_KEYS.TEAMS, JSON.stringify(teams));
      
      // Log activity if added by supervisor/analista
      if (addedBy) {
        this.logActivity('member_added', {
          teamId,
          memberName: memberData.name,
          memberEmail: memberData.email,
          addedBy,
          addedByRole: addedByRole || null
        });
      }
      return true;
    }
    return false;
  },

  removeTeamMember(teamId, memberEmail, removedBy = null, removedByRole = null) {
    const teams = this.getAllTeams();
    if (teams[teamId]) {
      const member = teams[teamId].members.find(m => m.email === memberEmail);
      teams[teamId].members = teams[teamId].members.filter(m => m.email !== memberEmail);
      SafeStorage.setItem(this.STORAGE_KEYS.TEAMS, JSON.stringify(teams));
      
      // Log activity if removed by supervisor/analista
      if (removedBy && member) {
        this.logActivity('member_removed', {
          teamId,
          memberName: member.name,
          memberEmail: memberEmail,
          removedBy,
          removedByRole: removedByRole || null
        });
      }
      return true;
    }
    return false;
  },

  // Activity Log
  logActivity(type, data) {
    const logs = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.ACTIVITY_LOG) || '[]');
    logs.unshift({
      type,
      data,
      timestamp: new Date().toISOString()
    });
    // Keep only last 100 activity logs
    if (logs.length > 100) logs.length = 100;
    SafeStorage.setItem(this.STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(logs));
  },

  getActivityLog() {
    return JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.ACTIVITY_LOG) || '[]');
  },

  // Authentication
  login(email) {
    const normalizedEmail = email.toLowerCase().trim();
    
    // 1) Test accounts
    if (this.TEST_ACCOUNTS[normalizedEmail]) {
      const user = this.TEST_ACCOUNTS[normalizedEmail];
      SafeStorage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
      return user;
    }

    // 2) Global Calidad users (not tied to a team)
    try {
      const calidadUsersStr = window.localStorage.getItem('ridery_calidad_users');
      const calidadUsers = calidadUsersStr ? JSON.parse(calidadUsersStr) : [];
      const foundCalidad = calidadUsers.find(u => (u.email || '').toLowerCase().trim() === normalizedEmail);
      if (foundCalidad) {
        const user = { email: normalizedEmail, role: 'calidad' };
        SafeStorage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
        return user;
      }
    } catch (e) {
      // ignore parse/localStorage errors and continue
    }

    // 3) Team members (preserve stored role if present)
    const teams = this.getAllTeams();
    for (let teamId in teams) {
      const member = teams[teamId].members.find(m => m.email === normalizedEmail);
      if (member) {
        const user = { email: normalizedEmail, role: (member.role || 'viewer'), team: teamId };
        SafeStorage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
        return user;
      }
    }

    // 4) Default viewer
    const user = { email: normalizedEmail, role: 'viewer' };
    SafeStorage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  },

  logout() {
    SafeStorage.removeItem(this.STORAGE_KEYS.USER);
  },

  getCurrentUser() {
    const userStr = SafeStorage.getItem(this.STORAGE_KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
  },

  isEditor() {
    const user = this.getCurrentUser();
    // 'editor' is now 'calidad', but support both for backwards compatibility
    return user && (user.role === 'editor' || user.role === 'calidad' || user.role === 'admin');
  },

  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'admin';
  },

  isCalidad() {
    const user = this.getCurrentUser();
    return user && (user.role === 'calidad' || user.role === 'editor');
  },

  isSupervisor() {
    const user = this.getCurrentUser();
    return user && user.role === 'supervisor';
  },

  isAnalista() {
    const user = this.getCurrentUser();
    return user && user.role === 'analista';
  },

  // Check if user has supervisor-level permissions (supervisor or analista)
  hasSupervisorPermissions() {
    const user = this.getCurrentUser();
    return user && (user.role === 'supervisor' || user.role === 'analista');
  },

  // Check if user can manage team members (admin, calidad/editor, supervisor, analista)
  canManageTeamMembers() {
    const user = this.getCurrentUser();
    if (!user) return false;
    return user.role === 'admin' || user.role === 'editor' || user.role === 'calidad' || user.role === 'supervisor' || user.role === 'analista';
  },

  getUserTeam() {
    const user = this.getCurrentUser();
    return user ? user.team : null;
  },

  // Audit CRUD operations with new structure
  getAllAudits() {
    const auditsStr = SafeStorage.getItem(this.STORAGE_KEYS.AUDITS);
    return auditsStr ? JSON.parse(auditsStr) : [];
  },

  getAuditById(id) {
    const audits = this.getAllAudits();
    return audits.find(audit => audit.id === id);
  },

  createAudit(auditData) {
    const audits = this.getAllAudits();
    const newAudit = {
      id: this.generateId(),
      ...auditData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    audits.push(newAudit);
    SafeStorage.setItem(this.STORAGE_KEYS.AUDITS, JSON.stringify(audits));
    return newAudit;
  },

  updateAudit(id, auditData) {
    const audits = this.getAllAudits();
    const index = audits.findIndex(audit => audit.id === id);
    if (index !== -1) {
      audits[index] = {
        ...audits[index],
        ...auditData,
        updatedAt: new Date().toISOString()
      };
      SafeStorage.setItem(this.STORAGE_KEYS.AUDITS, JSON.stringify(audits));
      return audits[index];
    }
    return null;
  },

  deleteAudit(id) {
    const audits = this.getAllAudits();
    const filtered = audits.filter(audit => audit.id !== id);
    SafeStorage.setItem(this.STORAGE_KEYS.AUDITS, JSON.stringify(filtered));
    return true;
  },

  // Get audits by month
  getAuditsByMonth(year, month) {
    const audits = this.getAllAudits();
    let filteredAudits = audits.filter(audit => {
      const auditDate = new Date(audit.date);
      return auditDate.getFullYear() === year && auditDate.getMonth() === month;
    });
    
    // Apply team-based filtering for team users
    const userTeam = this.getUserTeam();
    if (userTeam) {
      filteredAudits = filteredAudits.filter(audit => audit.teamId === userTeam);
    }
    
    return filteredAudits;
  },

  // Search and filter
  searchAudits(searchTerm, teamFilter) {
    let audits = this.getAllAudits();
    
    // Apply team-based filtering for team users
    const userTeam = this.getUserTeam();
    if (userTeam) {
      // If user belongs to a specific team, only show audits from that team
      audits = audits.filter(audit => audit.teamId === userTeam);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      audits = audits.filter(audit => 
        audit.agentName.toLowerCase().includes(term) ||
        (audit.ticketId && audit.ticketId.toLowerCase().includes(term)) ||
        (audit.observations && audit.observations.toLowerCase().includes(term)) ||
        (audit.ticketSummary && audit.ticketSummary.toLowerCase().includes(term))
      );
    }
    
    if (teamFilter) {
      audits = audits.filter(audit => audit.teamId === teamFilter);
    }
    
    return audits;
  },

  // Calculate score based on new pillar system with STRICT 2-error rule
  // Rule: 2 or more errors = 0 points (no partial scores)
  calculateAuditScore(evaluationData) {
    // Count total errors (unchecked items)
    const empatiaCriteria = [
      'metodoRided', 'lenguajePositivo', 'acompanamiento', 
      'personalizacion', 'estructura', 'usoIaOrtografia'
    ];
    
    const gestionTicketCriteria = [
      'estadosTicket', 'ausenciaCliente', 'validacionHistorial', 
      'tipificacionCriterio', 'retencionTickets', 'tiempoRespuesta', 'tiempoGestion'
    ];
    
    const conocimientoCriteria = [
      'serviciosPromociones', 'informacionVeraz', 
      'parlamentosContingencia', 'honestidadTransparencia'
    ];
    
    const herramientasCriteria = [
      'rideryOffice', 'adminZendesk', 'driveManuales', 
      'slack', 'generacionReportes', 'cargaIncidencias'
    ];

    // Count errors (unchecked = error)
    let totalErrors = 0;
    
    empatiaCriteria.forEach(criterion => {
      if (!evaluationData.empatia?.[criterion]) totalErrors++;
    });
    
    gestionTicketCriteria.forEach(criterion => {
      if (!evaluationData.gestion?.ticket?.[criterion]) totalErrors++;
    });
    
    conocimientoCriteria.forEach(criterion => {
      if (!evaluationData.gestion?.conocimiento?.[criterion]) totalErrors++;
    });
    
    herramientasCriteria.forEach(criterion => {
      if (!evaluationData.gestion?.herramientas?.[criterion]) totalErrors++;
    });

    // STRICT RULE: 2 or more errors = 0 points
    if (totalErrors >= 2) {
      return 0;
    }

    // If 0 or 1 error, calculate normal score
    // Pilar Empatía (50%) - 6 criterios x 8.33 puntos = 50%
    const empatiaScore = empatiaCriteria.reduce((sum, criterion) => {
      return sum + (evaluationData.empatia?.[criterion] ? 8.33 : 0);
    }, 0);

    // Pilar Gestión (50%)
    // Gestión de ticket (33% of 50% = 16.67%)
    const gestionTicketScore = gestionTicketCriteria.reduce((sum, criterion) => {
      return sum + (evaluationData.gestion?.ticket?.[criterion] ? (16.67 / 7) : 0);
    }, 0);

    // Conocimiento Integral (33% of 50% = 16.67%)
    const conocimientoScore = conocimientoCriteria.reduce((sum, criterion) => {
      return sum + (evaluationData.gestion?.conocimiento?.[criterion] ? (16.67 / 4) : 0);
    }, 0);

    // Uso estratégico de herramientas (33% of 50% = 16.67%)
    const herramientasScore = herramientasCriteria.reduce((sum, criterion) => {
      return sum + (evaluationData.gestion?.herramientas?.[criterion] ? (16.67 / 6) : 0);
    }, 0);

    const totalScore = empatiaScore + gestionTicketScore + conocimientoScore + herramientasScore;
    return Math.round(totalScore * 100) / 100;
  },

  // Metrics calculations
  getWeeklyMetrics() {
    const audits = this.getAllAudits();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklyAudits = audits.filter(audit => 
      new Date(audit.date) >= oneWeekAgo
    );
    
    return this.calculateMetrics(weeklyAudits);
  },

  getMonthlyMetrics() {
    const audits = this.getAllAudits();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    const monthlyAudits = audits.filter(audit => {
      const auditDate = new Date(audit.date);
      return auditDate.getFullYear() === currentYear && auditDate.getMonth() === currentMonth;
    });
    
    return this.calculateMetrics(monthlyAudits);
  },

  getAnnualMetrics() {
    const audits = this.getAllAudits();
    const currentYear = new Date().getFullYear();
    
    const annualAudits = audits.filter(audit => 
      new Date(audit.date).getFullYear() === currentYear
    );
    
    return this.calculateMetrics(annualAudits);
  },

  calculateMetrics(audits) {
    const total = audits.length;
    
    if (total === 0) {
      return {
        total: 0,
        avgScore: 0,
        uniqueAgents: 0,
        byAgent: {},
        byTeam: {},
        byDate: {}
      };
    }
    
    // Calculate average score
    const totalScore = audits.reduce((sum, audit) => sum + parseFloat(audit.score || 0), 0);
    const avgScore = (totalScore / total).toFixed(1);
    
    // Get unique agents
    const uniqueAgents = [...new Set(audits.map(audit => audit.agentName))];
    
    // Group by agent
    const byAgent = {};
    audits.forEach(audit => {
      if (!byAgent[audit.agentName]) {
        byAgent[audit.agentName] = {
          count: 0,
          totalScore: 0,
          lastAudit: audit.date,
          teamId: audit.teamId,
          audits: []
        };
      }
      byAgent[audit.agentName].count++;
      byAgent[audit.agentName].totalScore += parseFloat(audit.score || 0);
      byAgent[audit.agentName].audits.push(audit);
      if (new Date(audit.date) > new Date(byAgent[audit.agentName].lastAudit)) {
        byAgent[audit.agentName].lastAudit = audit.date;
      }
    });
    
    // Calculate average for each agent
    Object.keys(byAgent).forEach(agentName => {
      byAgent[agentName].avgScore = (byAgent[agentName].totalScore / byAgent[agentName].count).toFixed(1);
    });

    // Group by team
    const byTeam = {};
    audits.forEach(audit => {
      if (!audit.teamId) return;
      if (!byTeam[audit.teamId]) {
        byTeam[audit.teamId] = {
          count: 0,
          totalScore: 0,
          agents: new Set()
        };
      }
      byTeam[audit.teamId].count++;
      byTeam[audit.teamId].totalScore += parseFloat(audit.score || 0);
      byTeam[audit.teamId].agents.add(audit.agentName);
    });

    // Calculate average for each team
    Object.keys(byTeam).forEach(teamId => {
      byTeam[teamId].avgScore = (byTeam[teamId].totalScore / byTeam[teamId].count).toFixed(1);
      byTeam[teamId].uniqueAgents = byTeam[teamId].agents.size;
      delete byTeam[teamId].agents;
    });
    
    // Group by date
    const byDate = {};
    audits.forEach(audit => {
      const date = audit.date;
      if (!byDate[date]) {
        byDate[date] = { count: 0, totalScore: 0 };
      }
      byDate[date].count++;
      byDate[date].totalScore += parseFloat(audit.score || 0);
    });
    
    return {
      total,
      avgScore: parseFloat(avgScore),
      uniqueAgents: uniqueAgents.length,
      byAgent,
      byTeam,
      byDate,
      audits
    };
  },

  getMonthlyBreakdown() {
    const audits = this.getAllAudits();
    const currentYear = new Date().getFullYear();
    
    const monthlyData = {};
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Initialize all months
    months.forEach((month, index) => {
      monthlyData[month] = { count: 0, totalScore: 0 };
    });
    
    // Populate with data
    audits.forEach(audit => {
      const auditDate = new Date(audit.date);
      if (auditDate.getFullYear() === currentYear) {
        const monthIndex = auditDate.getMonth();
        const monthName = months[monthIndex];
        monthlyData[monthName].count++;
        monthlyData[monthName].totalScore += parseFloat(audit.score || 0);
      }
    });
    
    return monthlyData;
  },

  // Get all weeks from January to current date (Monday-Friday only)
  getWeeksOfYear() {
    const currentYear = new Date().getFullYear();
    const weeks = [];
    let weekNumber = 1;
    
    // Start from January 1st
    let currentDate = new Date(currentYear, 0, 1);
    
    // Find the first Monday of the year
    while (currentDate.getDay() !== 1) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const now = new Date();
    
    while (currentDate <= now) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 4); // Friday (Monday + 4 days)
      
      // Only add weeks that have started
      if (weekStart <= now) {
        weeks.push({
          weekNumber: weekNumber,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd > now ? now.toISOString().split('T')[0] : weekEnd.toISOString().split('T')[0],
          label: `Semana ${weekNumber}: ${weekStart.getDate()}-${weekStart.getMonth() + 1}-${currentYear} a ${(weekEnd > now ? now : weekEnd).getDate()}-${(weekEnd > now ? now : weekEnd).getMonth() + 1}-${currentYear}`
        });
        weekNumber++;
      }
      
      // Move to next Monday
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return weeks;
  },

  // Get weeks for a specific month (Monday-Sunday, 7 days, start on first Monday)
  getWeeksOfMonth(year, month) {
    // Override específico para Diciembre 2025 según requerimiento
    if (year === 2025 && month === 11) {
      return [
        {
          weekNumber: 1,
          startDate: '2025-12-01',
          endDate: '2025-12-07',
          label: 'Semana 01/12 al 07/12'
        },
        {
          weekNumber: 2,
          startDate: '2025-12-08',
          endDate: '2025-12-14',
          label: 'Semana 08/12 al 14/12'
        },
        {
          weekNumber: 3,
          startDate: '2025-12-15',
          endDate: '2025-12-21',
          label: 'Semana 15/12 al 21/12'
        },
        {
          weekNumber: 4,
          startDate: '2025-12-27',
          endDate: '2026-01-02',
          label: 'Semana 27/12 al 02/01'
        }
      ];
    }

    const weeks = [];

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Find the first Monday of the month
    const firstMonday = new Date(firstDayOfMonth);
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }

    let currentStart = new Date(firstMonday);
    let weekNumber = 1;

    while (currentStart <= lastDayOfMonth) {
      const weekStart = new Date(currentStart);
      const weekEnd = new Date(currentStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Always 7-day span

      const y1 = weekStart.getFullYear();
      const m1 = String(weekStart.getMonth() + 1).padStart(2, '0');
      const d1 = String(weekStart.getDate()).padStart(2, '0');
      const y2 = weekEnd.getFullYear();
      const m2 = String(weekEnd.getMonth() + 1).padStart(2, '0');
      const d2 = String(weekEnd.getDate()).padStart(2, '0');

      weeks.push({
        weekNumber,
        startDate: `${y1}-${m1}-${d1}`,
        endDate: `${y2}-${m2}-${d2}`,
        label: `Semana ${d1}/${m1} al ${d2}/${m2}`
      });

      weekNumber++;
      currentStart.setDate(currentStart.getDate() + 7);
    }

    return weeks;
  },

  // Get audits for a specific week
  getAuditsByWeek(weekStartDate, weekEndDate) {
    const audits = this.getAllAudits();
    return audits.filter(audit => {
      const auditDate = audit.date;
      return auditDate >= weekStartDate && auditDate <= weekEndDate;
    });
  },

  // Get metrics by week
  getWeeklyMetricsByWeek(weekStartDate, weekEndDate) {
    const weekAudits = this.getAuditsByWeek(weekStartDate, weekEndDate);
    return this.calculateMetrics(weekAudits);
  },

  getDailyBreakdownLastWeek() {
    const audits = this.getAllAudits();
    const dailyData = {};
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      const dateStr = date.toISOString().split('T')[0];
      
      dailyData[`${dayName} ${date.getDate()}`] = { 
        count: 0, 
        totalScore: 0,
        date: dateStr
      };
    }
    
    // Populate with data
    audits.forEach(audit => {
      const auditDate = new Date(audit.date);
      const dayName = days[auditDate.getDay()];
      const dayLabel = `${dayName} ${auditDate.getDate()}`;
      
      Object.keys(dailyData).forEach(key => {
        if (dailyData[key].date === audit.date) {
          dailyData[key].count++;
          dailyData[key].totalScore += parseFloat(audit.score || 0);
        }
      });
    });
    
    return dailyData;
  },

  // Get top agent per team
  getTopAgentsByTeam() {
    const metrics = this.calculateMetrics(this.getAllAudits());
    const topByTeam = {};

    Object.entries(metrics.byAgent).forEach(([agentName, data]) => {
      const teamId = data.teamId;
      if (!teamId) return;
      
      if (!topByTeam[teamId] || parseFloat(data.avgScore) > parseFloat(topByTeam[teamId].avgScore)) {
        topByTeam[teamId] = {
          agentName,
          avgScore: data.avgScore,
          count: data.count
        };
      }
    });

    return topByTeam;
  },

  // Weekly Metrics Management (Manual Input)
  getWeeklyMetricsData(year, month) {
    const key = `${year}-${month}`;
    const allData = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.WEEKLY_METRICS) || '{}');
    return allData[key] || {};
  },

  saveWeeklyMetricsData(year, month, data) {
    const key = `${year}-${month}`;
    const allData = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.WEEKLY_METRICS) || '{}');
    allData[key] = data;
    SafeStorage.setItem(this.STORAGE_KEYS.WEEKLY_METRICS, JSON.stringify(allData));
  },

  getWeekConfig(year, month) {
    const key = `${year}-${month}`;
    const allConfigs = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.WEEK_CONFIG) || '{}');
    return allConfigs[key] || [];
  },

  ensureWeekConfig(year, month) {
    const key = `${year}-${month}`;
    const allConfigs = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.WEEK_CONFIG) || '{}');
    // Solo generar si no existe configuración previa para este mes/año
    const existing = allConfigs[key];
    if (!existing || !Array.isArray(existing) || existing.length === 0) {
      allConfigs[key] = this.getWeeksOfMonth(year, month);
      SafeStorage.setItem(this.STORAGE_KEYS.WEEK_CONFIG, JSON.stringify(allConfigs));
      return allConfigs[key];
    }
    return existing;
  },

  getConfiguredMonths(year) {
    const allConfigs = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.WEEK_CONFIG) || '{}');
    return Object.keys(allConfigs)
      .map(key => key.split('-'))
      .filter(parts => parseInt(parts[0]) === year)
      .map(parts => parseInt(parts[1]))
      .sort((a, b) => a - b);
  },

  // Save a single week's metrics for one agent
  saveWeeklyMetric(agentName, meta, metrics) {
    const key = `${meta.year}-${meta.month}`;
    const allData = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.WEEKLY_METRICS) || '{}');
    if (!allData[key]) {
      allData[key] = {};
    }
    if (!allData[key][agentName]) {
      allData[key][agentName] = {};
    }
    allData[key][agentName][meta.week] = metrics;
    SafeStorage.setItem(this.STORAGE_KEYS.WEEKLY_METRICS, JSON.stringify(allData));
  },

  saveWeekConfig(year, month, weeks) {
    const key = `${year}-${month}`;
    const allConfigs = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.WEEK_CONFIG) || '{}');
    allConfigs[key] = weeks;
    SafeStorage.setItem(this.STORAGE_KEYS.WEEK_CONFIG, JSON.stringify(allConfigs));
  },

  // Audit Views Tracking
  markAuditAsViewed(auditId, viewerEmail) {
    const views = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.AUDIT_VIEWS) || '{}');
    const now = new Date().toISOString();
    if (!views[auditId]) {
      views[auditId] = [];
    }
    // Normalize legacy string entries to objects
    const normalized = views[auditId].map(v => typeof v === 'string' ? { email: v, timestamp: now } : v);
    const already = normalized.find(v => v.email === viewerEmail);
    if (!already) {
      normalized.push({ email: viewerEmail, timestamp: now });
      views[auditId] = normalized;
      SafeStorage.setItem(this.STORAGE_KEYS.AUDIT_VIEWS, JSON.stringify(views));
    }
  },

  hasViewedAudit(auditId, viewerEmail) {
    const views = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.AUDIT_VIEWS) || '{}');
    if (!views[auditId]) return false;
    return views[auditId].some(v => (typeof v === 'string' ? v === viewerEmail : v.email === viewerEmail));
  },

  getAuditViewEvents() {
    const views = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.AUDIT_VIEWS) || '{}');
    const events = [];
    Object.entries(views).forEach(([auditId, entries]) => {
      if (!Array.isArray(entries)) return;
      entries.forEach(entry => {
        if (typeof entry === 'string') return; // legacy without timestamp, skip to avoid unordered noise
        events.push({ auditId, email: entry.email, timestamp: entry.timestamp });
      });
    });
    return events;
  },

  // Audit Comments (Conversation between agent and editor)
  // Now supports multiple messages as a conversation
  saveAuditComment(auditId, senderEmail, senderRole, comment) {
    const comments = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.AUDIT_COMMENTS) || '{}');
    if (!comments[auditId]) {
      comments[auditId] = [];
    }
    comments[auditId].push({
      senderEmail,
      senderRole,
      comment,
      timestamp: new Date().toISOString()
    });
    SafeStorage.setItem(this.STORAGE_KEYS.AUDIT_COMMENTS, JSON.stringify(comments));
  },

  getAuditComments(auditId) {
    const comments = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.AUDIT_COMMENTS) || '{}');
    // Support legacy format (single comment object) and new format (array)
    const auditComments = comments[auditId];
    if (!auditComments) return [];
    if (Array.isArray(auditComments)) return auditComments;
    // Legacy: convert single comment to array
    return [{
      senderEmail: auditComments.agentEmail,
      senderRole: 'viewer',
      comment: auditComments.comment,
      timestamp: auditComments.timestamp
    }];
  },

  getAuditComment(auditId) {
    // Legacy support: returns last comment for backwards compatibility
    const comments = this.getAuditComments(auditId);
    if (comments.length === 0) return null;
    const last = comments[comments.length - 1];
    return {
      agentEmail: last.senderEmail,
      comment: last.comment,
      timestamp: last.timestamp
    };
  },

  getAllAuditComments() {
    return JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.AUDIT_COMMENTS) || '{}');
  },

  // Add or update team member with shift information
  addTeamMemberWithShift(teamId, memberData) {
    const teams = this.getAllTeams();
    if (teams[teamId]) {
      // Ensure shift is included
      const member = {
        ...memberData,
        team: teamId,
        shift: memberData.shift || 'AM',
        addedAt: new Date().toISOString()
      };
      teams[teamId].members.push(member);
      SafeStorage.setItem(this.STORAGE_KEYS.TEAMS, JSON.stringify(teams));
      return true;
    }
    return false;
  },

  updateTeamMember(teamId, originalEmail, memberData) {
    const teams = this.getAllTeams();
    if (!teams[teamId] || !teams[teamId].members) return false;

    const memberIndex = teams[teamId].members.findIndex(m => m.email === originalEmail);
    if (memberIndex === -1) return false;

    const updatedMember = {
      ...teams[teamId].members[memberIndex],
      ...memberData,
      team: teamId
    };

    teams[teamId].members[memberIndex] = updatedMember;
    SafeStorage.setItem(this.STORAGE_KEYS.TEAMS, JSON.stringify(teams));
    return true;
  },

  // Utility
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-VE', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  },

  // Calculate satisfaction percentage for an agent based on weekly metrics
  // Solo cuenta si tiene al menos 1 ticket; de lo contrario devuelve null para no penalizar
  calculateAgentSatisfaction(agentName, year, month) {
    const weeklyData = this.getWeeklyMetricsData(year, month);
    if (!weeklyData[agentName]) return { pct: null, totalTickets: 0 };
    
    let totalTickets = 0;
    let totalGood = 0;
    
    Object.values(weeklyData[agentName]).forEach(weekData => {
      if (weekData.tickets) {
        totalTickets += weekData.tickets || 0;
        totalGood += weekData.ticketsGood || 0;
      }
    });
    
    if (totalTickets === 0) return { pct: null, totalTickets: 0 };
    return { pct: Math.round((totalGood / totalTickets) * 100), totalTickets };
  },

  // Get agent email by name (from teams)
  getAgentEmailByName(agentName) {
    const teams = this.getAllTeams();
    for (const team of Object.values(teams)) {
      if (team.members) {
        const member = team.members.find(m => m.name === agentName);
        if (member) return member.email;
      }
    }
    return null;
  },

  // Delete a specific week from configuration
  deleteWeekFromConfig(year, month, weekIndex) {
    const key = `${year}-${month}`;
    const allConfigs = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.WEEK_CONFIG) || '{}');
    const weeks = allConfigs[key];

    if (!weeks || !Array.isArray(weeks)) {
      alert(`No se encontró configuración para ${month}/${year}. Por favor, configure las semanas primero.`);
      return false;
    }

    if (weeks.length <= 1) {
      alert('No se puede eliminar la última semana. Debe haber al menos una semana configurada.');
      return false;
    }

    if (weekIndex < 0 || weekIndex >= weeks.length) {
      alert(`Índice de semana inválido (${weekIndex + 1}). La configuración tiene ${weeks.length} semanas.`);
      return false;
    }

    weeks.splice(weekIndex, 1);
    allConfigs[key] = weeks;
    SafeStorage.setItem(this.STORAGE_KEYS.WEEK_CONFIG, JSON.stringify(allConfigs));
    return true;
  },

  // Connection Hours Management
  // Data structure: { 'year-month': { 'agentName': { weekIndex: { days: { 'YYYY-MM-DD': { hours: 'HH:MM:SS', status: 'worked'|'libre'|'vacaciones'|'cambio'|'guardia' } }, reason } } } }
  getConnectionHoursData(year, month) {
    const key = `${year}-${month}`;
    const allData = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.CONNECTION_HOURS) || '{}');
    return allData[key] || {};
  },

  saveConnectionHoursData(year, month, data) {
    const key = `${year}-${month}`;
    const allData = JSON.parse(SafeStorage.getItem(this.STORAGE_KEYS.CONNECTION_HOURS) || '{}');
    allData[key] = data;
    SafeStorage.setItem(this.STORAGE_KEYS.CONNECTION_HOURS, JSON.stringify(allData));
  },

  // Save connection hours for a single agent in a specific week
  saveAgentConnectionHours(agentName, year, month, weekIndex, hoursData) {
    const allData = this.getConnectionHoursData(year, month);
    if (!allData[agentName]) {
      allData[agentName] = {};
    }
    allData[agentName][weekIndex] = hoursData;
    this.saveConnectionHoursData(year, month, allData);
  },

  // Save daily hours for a single agent on a specific date
  saveAgentDailyHours(agentName, year, month, weekIndex, dateStr, dayData) {
    const allData = this.getConnectionHoursData(year, month);
    if (!allData[agentName]) {
      allData[agentName] = {};
    }
    if (!allData[agentName][weekIndex]) {
      allData[agentName][weekIndex] = { days: {}, reason: '' };
    }
    if (!allData[agentName][weekIndex].days) {
      allData[agentName][weekIndex].days = {};
    }
    allData[agentName][weekIndex].days[dateStr] = dayData;
    this.saveConnectionHoursData(year, month, allData);
  },

  // Clear/delete agent daily hours for a specific date
  clearAgentDailyHours(agentName, year, month, weekIndex, dateStr) {
    const allData = this.getConnectionHoursData(year, month);
    if (allData[agentName] && allData[agentName][weekIndex] && allData[agentName][weekIndex].days && allData[agentName][weekIndex].days[dateStr]) {
      delete allData[agentName][weekIndex].days[dateStr];
      this.saveConnectionHoursData(year, month, allData);
    }
  },

  // Get expected daily hours based on shift type
  // 8h para turnos normales (AM, PM, Fin de Semana)
  // 6h para turnos de madrugada
  getExpectedDailyHours(shift) {
    const overnightShifts = ['Madrugada Semana Completa', 'Madrugada Entre Semana', 'Madrugada', 'Madrugada Fin de Semana'];
    if (overnightShifts.includes(shift)) {
      return 6;
    }
    // Turnos normales: 8 horas diarias
    return 8;
  },

  // Calculate expected weekly hours based on shift
  // For normal week shifts: 5 days * hours
  // For weekend shifts: 2 days * hours
  getExpectedWeeklyHours(shift) {
    const weekendShifts = ['Fin de Semana AM', 'Fin de Semana PM', 'Madrugada Fin de Semana'];
    const dailyHours = this.getExpectedDailyHours(shift);
    
    if (weekendShifts.includes(shift)) {
      return dailyHours * 2; // 2 days
    }
    return dailyHours * 5; // 5 days
  },

  // Parse time string (HH:MM:SS or H:MM:SS) to total seconds
  parseTimeToSeconds(timeStr) {
    if (!timeStr || timeStr === 'Libre' || timeStr === 'VACACIONES' || timeStr === 'CAMBIO' || timeStr === 'GUARDIA') {
      return 0;
    }
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  },

  // Format seconds to HH:MM:SS
  formatSecondsToTime(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return '0:00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  // Update reason for discrepancy
  updateConnectionHoursReason(agentName, year, month, weekIndex, reason) {
    const allData = this.getConnectionHoursData(year, month);
    if (allData[agentName] && allData[agentName][weekIndex]) {
      allData[agentName][weekIndex].reason = reason;
      this.saveConnectionHoursData(year, month, allData);
    }
  },

  // Statistics Module - Audit Statistics Calculations
  // Define all audit criteria for statistics
  AUDIT_CRITERIA: {
    empatia: [
      { id: 'metodoRided', name: 'MÉTODO RIDED', description: 'Bienvenida, Indagación, Solución, Escucha Empática, Despedida' },
      { id: 'lenguajePositivo', name: 'LENGUAJE POSITIVO', description: 'Reconocimiento del contexto y estado del cliente. Cortesía' },
      { id: 'acompanamiento', name: 'ACOMPAÑAMIENTO', description: 'No abandono. Gestión del tiempo de espera' },
      { id: 'personalizacion', name: 'PERSONALIZACIÓN', description: 'Adaptación de plantillas. Evitar repetición' },
      { id: 'estructura', name: 'ESTRUCTURA', description: 'Consolidación de mensajes y ritmo de conversación' },
      { id: 'usoIaOrtografia', name: 'USO DE IA, ORTOGRAFÍA Y EMOJIS', description: 'Aplicación de IA, escritura correcta y comunicación visual adecuada' }
    ],
    gestion: {
      ticket: [
        { id: 'estadosTicket', name: 'Estados del Ticket', description: 'Proceso correcto en Zendesk' },
        { id: 'ausenciaCliente', name: 'Ausencia del Cliente', description: 'Manejo apropiado de no respuesta' },
        { id: 'validacionHistorial', name: 'Validación del Historial', description: 'Revisión de incidencias previas' },
        { id: 'tipificacionCriterio', name: 'Tipificación', description: 'Clasificación correcta del ticket' },
        { id: 'retencionTickets', name: 'Retención de Tickets', description: 'Mantener tickets activos apropiadamente' },
        { id: 'tiempoRespuesta', name: 'Tiempo de Respuesta', description: 'Cumplimiento de tiempos' },
        { id: 'tiempoGestion', name: 'Tiempo de Gestión', description: 'Eficiencia en el manejo' }
      ],
      conocimiento: [
        { id: 'serviciosPromociones', name: 'Servicios y Promociones', description: 'Conocimiento completo de ofertas' },
        { id: 'informacionVeraz', name: 'Información Veraz', description: 'Datos correctos y verificables' },
        { id: 'parlamentosContingencia', name: 'Parlamentos de Contingencia', description: 'Guiones para situaciones difíciles' },
        { id: 'honestidadTransparencia', name: 'Honestidad y Transparencia', description: 'Comunicación clara y directa' }
      ],
      herramientas: [
        { id: 'rideryOffice', name: 'Ridery Office', description: 'Dominio de plataforma principal' },
        { id: 'adminZendesk', name: 'Admin y Zendesk', description: 'Herramientas administrativas' },
        { id: 'driveManuales', name: 'Drive y Manuales', description: 'Consulta de documentación' },
        { id: 'slack', name: 'Slack', description: 'Comunicación interna' },
        { id: 'generacionReportes', name: 'Generación de Reportes', description: 'Creación de informes' },
        { id: 'cargaIncidencias', name: 'Carga de Incidencias', description: 'Registro apropiado' }
      ]
    }
  },

  // Get audits for a specific month and optionally filter by team
  getAuditsForStatistics(year, month, teamId = null) {
    const audits = this.getAllAudits();
    return audits.filter(audit => {
      const auditDate = new Date(audit.auditDate || audit.date);
      const matchesMonth = auditDate.getFullYear() === year && auditDate.getMonth() === month;
      const matchesTeam = !teamId || audit.teamId === teamId;
      return matchesMonth && matchesTeam;
    });
  },

  // Calculate statistics for a given set of audits
  calculateAuditStatistics(audits) {
    if (!audits || audits.length === 0) {
      return null;
    }

    const stats = {
      totalAudits: audits.length,
      averageScore: 0,
      scoreDistribution: { excellent: 0, good: 0, regular: 0, poor: 0 },
      criteriaDeficiencies: {},
      pillarDeficiencies: { empatia: 0, gestion: 0 },
      agentDeficiencies: {},
      tipificacionImpact: {},
      agentsByPillarIssue: { empatia: [], gestion: [] },
      topDeficientCriteria: [],
      agentRankings: []
    };

    // Initialize criteria deficiencies
    this.AUDIT_CRITERIA.empatia.forEach(c => {
      stats.criteriaDeficiencies[c.id] = { count: 0, agents: [], category: 'empatia', name: c.name };
    });
    this.AUDIT_CRITERIA.gestion.ticket.forEach(c => {
      stats.criteriaDeficiencies[c.id] = { count: 0, agents: [], category: 'gestion-ticket', name: c.name };
    });
    this.AUDIT_CRITERIA.gestion.conocimiento.forEach(c => {
      stats.criteriaDeficiencies[c.id] = { count: 0, agents: [], category: 'gestion-conocimiento', name: c.name };
    });
    this.AUDIT_CRITERIA.gestion.herramientas.forEach(c => {
      stats.criteriaDeficiencies[c.id] = { count: 0, agents: [], category: 'gestion-herramientas', name: c.name };
    });

    let totalScore = 0;

    // Process each audit
    audits.forEach(audit => {
      const score = parseFloat(audit.score || 0);
      totalScore += score;

      // Score distribution
      if (score >= 95) stats.scoreDistribution.excellent++;
      else if (score >= 80) stats.scoreDistribution.good++;
      else if (score >= 60) stats.scoreDistribution.regular++;
      else stats.scoreDistribution.poor++;

      // Initialize agent stats if not exists
      if (!stats.agentDeficiencies[audit.agentName]) {
        stats.agentDeficiencies[audit.agentName] = {
          totalAudits: 0,
          totalScore: 0,
          empatiaIssues: 0,
          gestionIssues: 0,
          criteriaIssues: {},
          teamId: audit.teamId
        };
      }
      stats.agentDeficiencies[audit.agentName].totalAudits++;
      stats.agentDeficiencies[audit.agentName].totalScore += score;

      // Tipificación impact
      const tipificacion = audit.tipificacion || 'Sin tipificación';
      if (!stats.tipificacionImpact[tipificacion]) {
        stats.tipificacionImpact[tipificacion] = { count: 0, totalScore: 0, deficiencies: 0 };
      }
      stats.tipificacionImpact[tipificacion].count++;
      stats.tipificacionImpact[tipificacion].totalScore += score;
      if (score < 80) {
        stats.tipificacionImpact[tipificacion].deficiencies++;
      }

      // Check evaluation data for deficiencies
      const evaluation = audit.evaluationData || {};
      let empatiaDeficiencyCount = 0;
      let gestionDeficiencyCount = 0;

      // Check empatia criteria
      this.AUDIT_CRITERIA.empatia.forEach(criterion => {
        const passed = evaluation.empatia && evaluation.empatia[criterion.id];
        if (!passed) {
          empatiaDeficiencyCount++;
          stats.criteriaDeficiencies[criterion.id].count++;
          if (!stats.criteriaDeficiencies[criterion.id].agents.includes(audit.agentName)) {
            stats.criteriaDeficiencies[criterion.id].agents.push(audit.agentName);
          }
          if (!stats.agentDeficiencies[audit.agentName].criteriaIssues[criterion.id]) {
            stats.agentDeficiencies[audit.agentName].criteriaIssues[criterion.id] = 0;
          }
          stats.agentDeficiencies[audit.agentName].criteriaIssues[criterion.id]++;
        }
      });

      // Check gestion criteria (ticket, conocimiento, herramientas)
      const gestionCategories = ['ticket', 'conocimiento', 'herramientas'];
      gestionCategories.forEach(cat => {
        this.AUDIT_CRITERIA.gestion[cat].forEach(criterion => {
          const passed = evaluation.gestion && evaluation.gestion[cat] && evaluation.gestion[cat][criterion.id];
          if (!passed) {
            gestionDeficiencyCount++;
            stats.criteriaDeficiencies[criterion.id].count++;
            if (!stats.criteriaDeficiencies[criterion.id].agents.includes(audit.agentName)) {
              stats.criteriaDeficiencies[criterion.id].agents.push(audit.agentName);
            }
            if (!stats.agentDeficiencies[audit.agentName].criteriaIssues[criterion.id]) {
              stats.agentDeficiencies[audit.agentName].criteriaIssues[criterion.id] = 0;
            }
            stats.agentDeficiencies[audit.agentName].criteriaIssues[criterion.id]++;
          }
        });
      });

      // Track pillar issues
      if (empatiaDeficiencyCount > 0) {
        stats.pillarDeficiencies.empatia++;
        stats.agentDeficiencies[audit.agentName].empatiaIssues++;
      }
      if (gestionDeficiencyCount > 0) {
        stats.pillarDeficiencies.gestion++;
        stats.agentDeficiencies[audit.agentName].gestionIssues++;
      }
    });

    // Calculate average score
    stats.averageScore = Math.round((totalScore / audits.length) * 100) / 100;

    // Calculate percentages for criteria deficiencies
    Object.keys(stats.criteriaDeficiencies).forEach(criterionId => {
      const deficiency = stats.criteriaDeficiencies[criterionId];
      deficiency.percentage = Math.round((deficiency.count / audits.length) * 100);
    });

    // Calculate tipificación averages and percentages
    Object.keys(stats.tipificacionImpact).forEach(tip => {
      const impact = stats.tipificacionImpact[tip];
      impact.averageScore = Math.round((impact.totalScore / impact.count) * 100) / 100;
      impact.deficiencyPercentage = Math.round((impact.deficiencies / impact.count) * 100);
      impact.impactPercentage = Math.round((impact.count / audits.length) * 100);
    });

    // Get top deficient criteria (sorted by count)
    stats.topDeficientCriteria = Object.entries(stats.criteriaDeficiencies)
      .map(([id, data]) => ({ id, ...data }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Identify agents with pillar issues
    Object.entries(stats.agentDeficiencies).forEach(([agentName, data]) => {
      if (data.empatiaIssues > 0) {
        const empatiaIssueRate = Math.round((data.empatiaIssues / data.totalAudits) * 100);
        if (empatiaIssueRate >= 30) {
          stats.agentsByPillarIssue.empatia.push({
            name: agentName,
            issueCount: data.empatiaIssues,
            totalAudits: data.totalAudits,
            issueRate: empatiaIssueRate
          });
        }
      }
      if (data.gestionIssues > 0) {
        const gestionIssueRate = Math.round((data.gestionIssues / data.totalAudits) * 100);
        if (gestionIssueRate >= 30) {
          stats.agentsByPillarIssue.gestion.push({
            name: agentName,
            issueCount: data.gestionIssues,
            totalAudits: data.totalAudits,
            issueRate: gestionIssueRate
          });
        }
      }
    });

    // Sort agents by issue rate
    stats.agentsByPillarIssue.empatia.sort((a, b) => b.issueRate - a.issueRate);
    stats.agentsByPillarIssue.gestion.sort((a, b) => b.issueRate - a.issueRate);

    // Agent rankings by average score
    stats.agentRankings = Object.entries(stats.agentDeficiencies)
      .filter(([, data]) => data.totalAudits > 0)
      .map(([name, data]) => ({
        name,
        totalAudits: data.totalAudits,
        averageScore: Math.round((data.totalScore / data.totalAudits) * 100) / 100,
        empatiaIssueRate: Math.round((data.empatiaIssues / data.totalAudits) * 100),
        gestionIssueRate: Math.round((data.gestionIssues / data.totalAudits) * 100),
        teamId: data.teamId
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    return stats;
  },

  // Get statistics grouped by team
  getStatisticsByTeam(year, month) {
    const teams = this.getAllTeams();
    const teamStats = {};

    Object.keys(teams).forEach(teamId => {
      const teamAudits = this.getAuditsForStatistics(year, month, teamId);
      if (teamAudits.length > 0) {
        teamStats[teamId] = {
          teamName: teams[teamId].name,
          teamColor: teams[teamId].color,
          stats: this.calculateAuditStatistics(teamAudits)
        };
      }
    });

    return teamStats;
  },

  // Get global statistics for a month
  getGlobalStatistics(year, month) {
    const audits = this.getAuditsForStatistics(year, month);
    return this.calculateAuditStatistics(audits);
  }
};

// Initialize on load
DataManager.init();
