// Main Application Logic
// Handles UI interactions, view management, and charts

const App = {
  currentView: 'dashboard',
  charts: {},
  memberModalMode: 'add',
  memberOriginalEmail: '',

  // Parse 'YYYY-MM-DD' as local date (avoid UTC shift)
  parseLocalDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(NaN);
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  },

  // Year override: allow selecting Dec 2025 when current year is 2026
  getEffectiveYearForMonth(monthIndex) {
    const cy = new Date().getFullYear();
    if (monthIndex === 11 && cy === 2026) return 2025;
    return cy;
  },

  // Soporta valores tipo "11" o "11|2025" en selects de mes
  parseSelectedMonthValue(value) {
    if (value === '' || value === null || value === undefined) {
      return { monthIndex: null, yearOverride: null };
    }
    const str = String(value);
    if (str.includes('|')) {
      const [m, y] = str.split('|');
      const monthIndex = parseInt(m, 10);
      const yearOverride = parseInt(y, 10);
      return {
        monthIndex: isNaN(monthIndex) ? null : monthIndex,
        yearOverride: isNaN(yearOverride) ? null : yearOverride
      };
    }
    const monthIndex = parseInt(str, 10);
    return { monthIndex: isNaN(monthIndex) ? null : monthIndex, yearOverride: null };
  },

  // Convert seconds -> H:MM:SS
  secondsToHMS(totalSeconds) {
    const s = Math.max(0, parseInt(totalSeconds, 10) || 0);
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  // Set a day status quickly (Libre / Guardia / Vacaciones / Clear) from UI
  setConnectionDayStatus(agentName, dateStr, status) {
    const yearFromDate = parseInt(dateStr.split('-')[0], 10);
    const monthIndex = parseInt(dateStr.split('-')[1], 10) - 1;
    if (isNaN(monthIndex) || monthIndex < 0) {
      alert('No se pudo determinar el mes de la fecha seleccionada.');
      return;
    }

    const weeks = DataManager.ensureWeekConfig(yearFromDate, monthIndex);
    const targetWeekIndex = weeks.findIndex(w => w.startDate <= dateStr && dateStr <= w.endDate);
    if (targetWeekIndex === -1) {
      alert('La fecha seleccionada no pertenece a una semana configurada.');
      return;
    }

    // Handle clear/delete status
    if (status === 'clear') {
      DataManager.clearAgentDailyHours(agentName, yearFromDate, monthIndex, targetWeekIndex, dateStr);
      const d = this.parseLocalDate(dateStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      alert(`Estado borrado para ${agentName} en ${dd}/${mm}.`);
      this.loadConnectionHours();
      return;
    }

    // Get hours label based on status
    const statusLabels = {
      'guardia': 'GUARDIA',
      'libre': 'Libre',
      'vacaciones': 'VACACIONES'
    };
    const hours = statusLabels[status] || status.toUpperCase();
    const statusDisplayNames = {
      'guardia': 'GUARDIA',
      'libre': 'LIBRE',
      'vacaciones': 'VACACIONES'
    };
    
    DataManager.saveAgentDailyHours(agentName, yearFromDate, monthIndex, targetWeekIndex, dateStr, { status, hours });
    const d = this.parseLocalDate(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    alert(`${statusDisplayNames[status] || status.toUpperCase()} marcado para ${agentName} en ${dd}/${mm}.`);
    this.loadConnectionHours();
  },

  // Open the connection status modal for advanced management
  openConnectionStatusModal(agentName, dateStr) {
    const modal = document.getElementById('connectionStatusModal');
    if (!modal) return;

    // Store agent and date in hidden fields
    document.getElementById('statusModalAgent').value = agentName;
    document.getElementById('statusModalDate').value = dateStr;

    // Display info
    const d = this.parseLocalDate(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    document.getElementById('statusModalInfo').textContent = `Agente: ${agentName}`;
    document.getElementById('statusModalDateDisplay').textContent = `Fecha: ${dd}/${mm}/${yyyy}`;

    // Reset form
    document.getElementById('statusTypeSelect').value = '';
    document.getElementById('statusNoteInput').value = '';
    document.getElementById('cambioOptions').style.display = 'none';
    const manualHoursInput = document.getElementById('manualHoursInput');
    if (manualHoursInput) manualHoursInput.value = '';
    const cambioHoursInput = document.getElementById('cambioHoursInput');
    if (cambioHoursInput) cambioHoursInput.value = '';
    const manualHoursOptions = document.getElementById('manualHoursOptions');
    if (manualHoursOptions) manualHoursOptions.style.display = 'none';

    // Precargar data existente (si la hay)
    try {
      const yearFromDate = parseInt(dateStr.split('-')[0], 10);
      const monthIndex = parseInt(dateStr.split('-')[1], 10) - 1;
      const weeks = DataManager.ensureWeekConfig(yearFromDate, monthIndex);
      const targetWeekIndex = weeks.findIndex(w => w.startDate <= dateStr && dateStr <= w.endDate);
      if (targetWeekIndex !== -1) {
        const connectionData = DataManager.getConnectionHoursData(yearFromDate, monthIndex);
        const weekData = connectionData?.[agentName]?.[targetWeekIndex];
        const dayData = weekData?.days?.[dateStr];
        if (dayData) {
          const rawStatus = String(dayData.status || '').trim();
          const status = rawStatus === 'guardia' ? 'vacante' : rawStatus;
          const statusSelect = document.getElementById('statusTypeSelect');
          if (statusSelect) statusSelect.value = status || '';

          const noteEl = document.getElementById('statusNoteInput');
          if (noteEl) noteEl.value = dayData.note || '';

          // Cargar horas según tipo
          if (status === 'worked') {
            const manualHoursInput = document.getElementById('manualHoursInput');
            if (manualHoursInput) manualHoursInput.value = dayData.hours || '';
          }
          if (status === 'cambio') {
            const cambioHoursInput = document.getElementById('cambioHoursInput');
            if (cambioHoursInput) cambioHoursInput.value = dayData.hours || '';
          }

          // Refrescar visibilidad de opciones
          this.onStatusTypeChange();
        }
      }
    } catch {
      // noop
    }

    modal.style.display = 'flex';
  },

  closeConnectionStatusModal() {
    const modal = document.getElementById('connectionStatusModal');
    if (modal) {
      modal.style.display = 'none';
    }
  },

  onStatusTypeChange() {
    const statusType = document.getElementById('statusTypeSelect').value;
    const cambioOptions = document.getElementById('cambioOptions');
    const manualHoursOptions = document.getElementById('manualHoursOptions');

    cambioOptions.style.display = statusType === 'cambio' ? 'block' : 'none';
    if (manualHoursOptions) {
      manualHoursOptions.style.display = statusType === 'worked' ? 'block' : 'none';
    }
  },

  saveConnectionStatus() {
    const agentName = document.getElementById('statusModalAgent').value;
    const dateStr = document.getElementById('statusModalDate').value;
    const statusType = document.getElementById('statusTypeSelect').value;
    const note = document.getElementById('statusNoteInput').value.trim();

    if (!agentName || !dateStr) {
      alert('Error: No se pudo identificar el agente o la fecha.');
      return;
    }

    if (!statusType) {
      alert('Por favor seleccione un tipo de estado.');
      return;
    }

    const yearFromDate = parseInt(dateStr.split('-')[0], 10);
    const monthIndex = parseInt(dateStr.split('-')[1], 10) - 1;
    const weeks = DataManager.ensureWeekConfig(yearFromDate, monthIndex);
    const targetWeekIndex = weeks.findIndex(w => w.startDate <= dateStr && dateStr <= w.endDate);

    if (targetWeekIndex === -1) {
      alert('La fecha seleccionada no pertenece a una semana configurada.');
      return;
    }

    const normalizeHms = (raw) => {
      const str = String(raw || '').trim();
      if (!str) return '';
      // Accept H:MM:SS or HH:MM:SS
      if (!/^\d{1,2}:\d{2}:\d{2}$/.test(str)) return '';
      const parts = str.split(':');
      const h = String(parseInt(parts[0], 10) || 0);
      const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
      const s = String(parseInt(parts[2], 10) || 0).padStart(2, '0');
      return `${h}:${m}:${s}`;
    };

    // Build day data
    const dayData = {
      status: statusType,
      hours: this.getStatusHoursLabel(statusType),
      note: note || ''
    };

    // Acción: edición manual de horas
    if (statusType === 'worked') {
      const manual = normalizeHms(document.getElementById('manualHoursInput')?.value);
      if (!manual) {
        alert('Por favor indique las horas en formato H:MM:SS.');
        return;
      }
      dayData.hours = manual;
    }

    // Handle cambio de guardia
    if (statusType === 'cambio') {
      const cambioHours = normalizeHms(document.getElementById('cambioHoursInput')?.value);
      if (!cambioHours) {
        alert('Para Cambio de Guardia, indique las horas en formato H:MM:SS.');
        return;
      }
      dayData.hours = cambioHours;
    }

    // Save the day data
    DataManager.saveAgentDailyHours(agentName, yearFromDate, monthIndex, targetWeekIndex, dateStr, dayData);

    this.closeConnectionStatusModal();
    this.loadConnectionHours();
  },

  getStatusHoursLabel(status) {
    const labels = {
      // Compatibilidad legacy: 'guardia' ahora se muestra como VACANTE
      'guardia': 'VACANTE',
      'vacante': 'VACANTE',
      'libre': 'Libre',
      'vacaciones': 'VACACIONES',
      'cambio': 'CAMBIO',
      'cambio_recibido': 'CAMBIO',
      'worked': ''
    };
    return labels[status] || status.toUpperCase();
  },

  // Observation Modal
  showObservationModal(title, content) {
    document.getElementById('observationTitle').textContent = '💬 Comentario de calidad';
    document.getElementById('observationContent').innerHTML = `
      <div style="background: linear-gradient(135deg, #eef2ff, #fff); border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1rem; display: grid; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: #4338ca; font-weight: 700;">
          <span style="display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; border-radius: 999px; background: #c7d2fe; color: #312e81; font-size: 0.9rem;">?</span>
          <span>${title}</span>
        </div>
        <div style="background: white; border: 1px dashed #cbd5e1; border-radius: 0.65rem; padding: 0.85rem; color: var(--text-primary); line-height: 1.5;">
          ${content || 'Sin comentario'}
        </div>
      </div>
    `;
    const modal = document.getElementById('observationModal');
    modal.style.display = 'flex';
    
    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.closeObservationModal();
      }
    };
  },

  closeObservationModal() {
    const modal = document.getElementById('observationModal');
    modal.style.display = 'none';
  },

  // Excel Import Modal
  openExcelImportModal() {
    const filterMonthMetrics = document.getElementById('filterMonthMetrics');
    const selectedMonth = filterMonthMetrics ? filterMonthMetrics.value : '';
    const selectedTeam = document.getElementById('filterTeamWeekly') ? document.getElementById('filterTeamWeekly').value : '';
    const selectedTeamLabel = document.getElementById('filterTeamWeekly') ? document.getElementById('filterTeamWeekly').selectedOptions[0].textContent : '';
    if (selectedMonth === '') {
      alert('Seleccione primero el mes y luego la semana donde desea cargar los datos.');
      return;
    }

    const parsed = this.parseSelectedMonthValue(selectedMonth);
    const monthIndex = parsed.monthIndex;
    const effectiveYear = parsed.yearOverride ?? this.getEffectiveYearForMonth(monthIndex);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const weeks = DataManager.ensureWeekConfig(effectiveYear, monthIndex) || [];

    const weekSelect = document.getElementById('excelWeekSelect');
    if (weekSelect) {
      weekSelect.innerHTML = weeks.map((week, idx) => `<option value="${idx}">Semana ${idx + 1}: ${week.startDate} al ${week.endDate}</option>`).join('');
    }

    const excelMonthInput = document.getElementById('excelSelectedMonth');
    if (excelMonthInput) {
      excelMonthInput.value = `${monthNames[monthIndex]} ${effectiveYear}`;
    }

    const excelTeamInput = document.getElementById('excelSelectedTeam');
    if (excelTeamInput) {
      // En la UI el valor vacío representa "Todos los Equipos"
      excelTeamInput.value = selectedTeamLabel || 'Todos los Equipos';
    }

    // Toggle entre semana y rango para métricas
    const modeSelect = document.getElementById('excelImportMode');
    const rangeWrapper = document.getElementById('excelRangeWrapper');
    const weekSelectContainer = weekSelect ? weekSelect.parentElement : null;
    const rangeStart = document.getElementById('excelRangeStart');
    const rangeEnd = document.getElementById('excelRangeEnd');

    if (modeSelect && rangeWrapper && weekSelectContainer) {
      const applyToggle = () => {
        const isRange = modeSelect.value === 'rango';
        rangeWrapper.style.display = isRange ? 'block' : 'none';
        weekSelectContainer.style.display = isRange ? 'none' : 'block';
      };
      // Defaults de rango: cubrir semanas configuradas del mes visible
      if (weeks && weeks.length > 0) {
        if (rangeStart && !rangeStart.value) rangeStart.value = weeks[0].startDate;
        if (rangeEnd && !rangeEnd.value) rangeEnd.value = weeks[weeks.length - 1].endDate;
      }
      applyToggle();
      modeSelect.onchange = applyToggle;
    }

    const modal = document.getElementById('excelImportModal');
    modal.style.display = 'flex';
    document.getElementById('excelPasteArea').value = '';
    
    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.closeExcelImportModal();
      }
    };
  },

  closeExcelImportModal() {
    const modal = document.getElementById('excelImportModal');
    modal.style.display = 'none';
  },

  importFromExcel() {
    const pasteArea = document.getElementById('excelPasteArea');
    const data = pasteArea.value.trim();
    
    if (!data) {
      alert('Por favor pegue los datos de Excel antes de importar.');
      return;
    }

    const selectedMonth = document.getElementById('filterMonthMetrics').value;
    const selectedTeam = document.getElementById('filterTeamWeekly').value;
    const selectedWeek = document.getElementById('excelWeekSelect') ? document.getElementById('excelWeekSelect').value : '';
    const excelImportMode = document.getElementById('excelImportMode') ? document.getElementById('excelImportMode').value : 'semana';
    const excelRangeStart = document.getElementById('excelRangeStart') ? document.getElementById('excelRangeStart').value : '';
    const excelRangeEnd = document.getElementById('excelRangeEnd') ? document.getElementById('excelRangeEnd').value : '';
    
    if (selectedMonth === '') {
      alert('Por favor seleccione un mes antes de importar.');
      return;
    }

    if (excelImportMode !== 'rango' && selectedWeek === '') {
      alert('Por favor seleccione la semana destino antes de importar.');
      return;
    }

    if (excelImportMode === 'rango') {
      if (!excelRangeStart || !excelRangeEnd) {
        alert('Indique el rango de fechas (desde y hasta) para importar por rango.');
        return;
      }
      const start = this.parseLocalDate(excelRangeStart);
      const end = this.parseLocalDate(excelRangeEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        alert('Rango de fechas inválido. Verifique las fechas desde/hasta.');
        return;
      }
    }

    const lines = data.split('\n');
    if (lines.length < 2) {
      alert('Los datos parecen estar vacíos o mal formateados.');
      return;
    }

    // Skip header row (first line)
    const dataLines = lines.slice(1);
    
    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      const values = line.split('\t');
      
      if (values.length < 6) {
        skipped++;
        continue;
      }

      // Clean agent name: keep only letters (including acentos), numbers, and spaces
      let agentName = values[0]
        .replace(/&nbsp;/g, ' ')
        .replace(/[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!agentName || agentName.length < 2) {
        skipped++;
        continue;
      }

      // Validar si el filtro es "todos" (asume value 'all' o similar)
      const teams = DataManager.getAllTeams();
      let agentExists = false;
      let targetTeams = [];
      // En la UI el valor vacío representa "Todos los Equipos"
      if (selectedTeam === 'all' || selectedTeam === '') {
        // Aplica a todos los equipos
        for (const teamId in teams) {
          const team = teams[teamId];
          if (team.members && team.members.some(m => m.name === agentName)) {
            agentExists = true;
            targetTeams.push(teamId);
          }
        }
      } else {
        // Solo equipo específico
        const team = teams[selectedTeam];
        if (team && team.members && team.members.some(m => m.name === agentName)) {
          agentExists = true;
          targetTeams.push(selectedTeam);
        }
      }
      if (!agentExists) {
        errors.push(`${agentName} no encontrado en el equipo`);
        skipped++;
        continue;
      }

      // Parse numeric values (handle comma as decimal separator)
      const tickets = parseInt(values[1]) || 0;
      const ticketsPerHourRaw = parseFloat(values[2].replace(',', '.')) || 0; // Promedio diario from Excel
      const ticketsBad = parseInt(values[3]) || 0;
      const ticketsGood = parseInt(values[4]) || 0;
      const firstResponse = parseFloat(values[5].replace(',', '.')) || 0;
      const resolutionTime = parseFloat(values[6].replace(',', '.')) || 0;
      const firstResponseMinutes = values[7] ? parseFloat(values[7].replace(',', '.')) || 0 : 0;

      // Use the ticketsPerHour from Excel (promedio diario) if available, otherwise calculate
      const ticketsPerHour = ticketsPerHourRaw > 0 ? ticketsPerHourRaw : (tickets > 0 ? tickets / 8 : 0);
      const califPct = (tickets > 0) ? ((ticketsGood / tickets) * 100) : 0;

      // Save según modo seleccionado
      const parsed = this.parseSelectedMonthValue(selectedMonth);
      const monthIndex = parsed.monthIndex;
      const currentYear = parsed.yearOverride ?? this.getEffectiveYearForMonth(monthIndex);
      const metrics = {
        tickets,
        ticketsBad,
        ticketsGood,
        firstResponse,
        resolutionTime,
        ticketsPerHour,
        firstResponseMinutes,
        califPct
      };
      if (excelImportMode === 'rango') {
        const overlappingWeeks = this.getWeeksOverlappingRange(excelRangeStart, excelRangeEnd);
        if (!overlappingWeeks.length) {
          skipped++;
          continue;
        }
        targetTeams.forEach(teamId => {
          overlappingWeeks.forEach(({ year, month, week }) => {
            DataManager.saveWeeklyMetric(agentName, { year, month, week, team: teamId }, metrics);
          });
        });
      } else {
        targetTeams.forEach(teamId => {
          DataManager.saveWeeklyMetric(agentName, {
            year: currentYear,
            month: monthIndex,
            week: parseInt(selectedWeek),
            team: teamId
          }, metrics);
        });
      }

      imported++;
    }

    this.closeExcelImportModal();
    
    if (imported > 0) {
      alert(`✅ ${imported} agente(s) importados correctamente.\n${skipped > 0 ? `⚠️ ${skipped} filas omitidas.` : ''}\n${errors.length > 0 ? `\nErrores:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...y ${errors.length - 5} más` : ''}` : ''}`);
      this.loadWeeklyMetrics();
    } else {
      alert('❌ No se pudo importar ningún dato. Verifique que:\n- Los agentes existan en el equipo seleccionado\n- Los datos estén en el formato correcto (separados por tabulación)\n- Haya seleccionado un mes');
    }
  },
  
  // Devuelve semanas que intersectan un rango de fechas [YYYY-MM-DD, YYYY-MM-DD]
  getWeeksOverlappingRange(startStr, endStr) {
    const start = this.parseLocalDate(startStr);
    const end = this.parseLocalDate(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
    // Recorre meses entre start y end
    const months = [];
    let y = start.getFullYear();
    let m = start.getMonth();
    const endY = end.getFullYear();
    const endM = end.getMonth();
    while (y < endY || (y === endY && m <= endM)) {
      months.push({ y, m });
      m++;
      if (m > 11) { m = 0; y++; }
    }
    const results = [];
    const seen = new Set();
    months.forEach(({ y, m }) => {
      const weeks = DataManager.ensureWeekConfig(y, m) || [];
      weeks.forEach((w, idx) => {
        const ws = this.parseLocalDate(w.startDate);
        const we = this.parseLocalDate(w.endDate);
        if (!(we < start || ws > end)) {
          const key = `${y}-${m}-${idx}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ year: y, month: m, week: idx });
          }
        }
      });
    });
    return results;
  },

  // Shift priority for sorting
  getShiftPriority(shift) {
    const order = {
      'AM': 1,
      'PM': 2,
      'Madrugada Semana Completa': 3,
      'Madrugada': 4,
      'Madrugada Fin de Semana': 4,
      'Fin de Semana AM': 5,
      'Fin de Semana PM': 6
    };
    return order[shift] || 999;
  },

  // Get shift badge HTML
  getShiftBadge(shift) {
    const shiftConfig = {
      'AM': { icon: '🌅', color: '#38CEA6', abbrev: 'AM' },
      'PM': { icon: '🌙', color: '#06b6d4', abbrev: 'PM' },
      'Madrugada Semana Completa': { icon: '⭐', color: '#a855f7', abbrev: 'Mad-SC' },
      'Madrugada': { icon: '✨', color: '#8b5cf6', abbrev: 'Mad' },
      'Madrugada Fin de Semana': { icon: '🌟', color: '#8b5cf6', abbrev: 'Mad-FDS' },
      'Fin de Semana AM': { icon: '📅', color: '#f59e0b', abbrev: 'FDS-AM' },
      'Fin de Semana PM': { icon: '🌆', color: '#ef4444', abbrev: 'FDS-PM' }
    };
    
    const config = shiftConfig[shift] || { icon: '❓', color: '#6b7280', abbrev: shift };
    
    return `<span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 600; background: ${config.color}; color: white; white-space: nowrap;">${config.icon} ${config.abbrev}</span>`;
  },

  // Get agent shift from teams
  getAgentShift(agentName, teams) {
    for (const teamId in teams) {
      const team = teams[teamId];
      if (team.members) {
        const member = team.members.find(m => m.name === agentName);
        if (member && member.shift) {
          return member.shift;
        }
      }
    }
    return 'N/A';
  },

  // Get member record by agent name
  getAgentMember(agentName, teams) {
    for (const teamId in teams) {
      const team = teams[teamId];
      if (team?.members) {
        const member = team.members.find(m => m.name === agentName);
        if (member) return { teamId, team, member };
      }
    }
    return null;
  },

  // Rotation days: numbers 0..6 (0=Dom, 1=Lun, ..., 6=Sáb)
  // Default: según turno (semana -> Lun..Vie, fin de semana -> Sáb/Dom)
  getAgentRotationDays(agentName, teams) {
    const found = this.getAgentMember(agentName, teams);
    const rotationDays = found?.member?.rotationDays;
    if (Array.isArray(rotationDays) && rotationDays.length > 0) {
      return Array.from(new Set(rotationDays.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n >= 0 && n <= 6))).sort((a, b) => a - b);
    }

    const shift = this.getAgentShift(agentName, teams);
    const weekendShifts = ['Fin de Semana AM', 'Fin de Semana PM', 'Madrugada Fin de Semana'];
    if (weekendShifts.includes(shift)) return [0, 6];
    return [1, 2, 3, 4, 5];
  },

  // Format seconds to H:MM:SS (allows negative)
  formatSignedHMS(seconds) {
    const s = parseInt(seconds, 10) || 0;
    const sign = s < 0 ? '-' : '';
    const abs = Math.abs(s);
    const hours = Math.floor(abs / 3600);
    const minutes = Math.floor((abs % 3600) / 60);
    const secs = abs % 60;
    return `${sign}${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  // Initialize application
  init() {
    // Check if user is logged in
    const user = DataManager.getCurrentUser();
    
    if (user) {
      this.showMainApp(user);
    } else {
      this.showAuthScreen();
    }

    this.setupEventListeners();
    this.populateMonthSelectors();
  },

  populateMonthSelectors() {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const configuredMonths = DataManager.getConfiguredMonths(currentYear);
    const isEditor = DataManager.isEditor();
    
    // For editors: show all 12 months
    // For users: show only current month + 2 months ahead (max 2 months advance)
    const monthsFullYear = Array.from({ length: 12 }, (_, i) => i);
    const maxMonthForUsers = Math.min(currentMonth + 2, 11); // Current + 2 months, max December
    const monthsForUsers = Array.from({ length: maxMonthForUsers + 1 }, (_, i) => i);

    const renderSelect = (select) => {
      if (!select) return;
      const previousValue = select.value;
      
      // Determine which months to show based on role
      let baseMonths;
      if (isEditor) {
        // Editors can see all months
        baseMonths = monthsFullYear;
      } else {
        // Users can only see up to current month + 2
        baseMonths = monthsForUsers;
      }
      // Incluir siempre Diciembre (11) por requerimiento de diciembre 2025
      if (!baseMonths.includes(11)) baseMonths = [...baseMonths, 11].sort((a,b) => a-b);
      
      if (previousValue && !baseMonths.includes(parseInt(previousValue))) {
        const prevMonth = parseInt(previousValue);
        if (!isNaN(prevMonth)) {
          baseMonths.push(prevMonth);
          baseMonths.sort((a, b) => a - b);
        }
      }
      select.innerHTML = '<option value="">Seleccionar mes...</option>';
      baseMonths.forEach(monthIndex => {
        const option = document.createElement('option');
        option.value = monthIndex;
        option.textContent = monthNames[monthIndex];
        select.appendChild(option);
      });

      // Agregar opción explícita adicional para Diciembre 2025
      const dec2025 = document.createElement('option');
      dec2025.value = '11|2025';
      dec2025.textContent = 'Diciembre 2025';
      select.appendChild(dec2025);

      if (previousValue && (baseMonths.includes(parseInt(previousValue)) || previousValue === '11|2025')) {
        select.value = previousValue;
      } else {
        select.value = '';
      }
    };

    renderSelect(document.getElementById('filterMonthMetrics'));
    renderSelect(document.getElementById('filterMonthlyMetrics'));
    renderSelect(document.getElementById('filterMonthConnectionHours'));
  },

  // Setup all event listeners
  setupEventListeners() {
    // Authentication
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    const clearSessionBtn = document.getElementById('clearSessionBtn');
    if (clearSessionBtn) {
      clearSessionBtn.addEventListener('click', () => this.handleClearSession());
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Navigation
    const navBtns = document.querySelectorAll('.nav-btn[data-view]');
    navBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Audit management
    const createAuditBtn = document.getElementById('createAuditBtn');
    if (createAuditBtn) {
      createAuditBtn.addEventListener('click', () => this.openAuditModal());
    }

    const auditForm = document.getElementById('auditForm');
    if (auditForm) {
      auditForm.addEventListener('submit', (e) => this.handleAuditSubmit(e));
    }

    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => this.closeAuditModal());
    }
    if (cancelModalBtn) {
      cancelModalBtn.addEventListener('click', () => this.closeAuditModal());
    }

    // Search and filter
    const searchAudit = document.getElementById('searchAudit');
    const filterTeam = document.getElementById('filterTeam');
    const filterMonth = document.getElementById('filterMonth');
    const filterMonthMetrics = document.getElementById('filterMonthMetrics');
    if (searchAudit) {
      searchAudit.addEventListener('input', () => this.filterAudits());
    }
    if (filterTeam) {
      filterTeam.addEventListener('change', () => this.filterAudits());
    }
    if (filterMonth) {
      filterMonth.addEventListener('change', () => this.filterAudits());
    }
    if (filterMonthMetrics) {
      filterMonthMetrics.addEventListener('change', () => this.loadWeeklyMetrics());
    }

    // Team filter for weekly metrics
    const filterTeamWeekly = document.getElementById('filterTeamWeekly');
    if (filterTeamWeekly) {
      filterTeamWeekly.addEventListener('change', () => this.loadWeeklyMetrics());
    }

    // Monthly metrics filter
    const filterMonthlyMetrics = document.getElementById('filterMonthlyMetrics');
    if (filterMonthlyMetrics) {
      filterMonthlyMetrics.addEventListener('change', () => this.loadMonthlyMetrics());
    }

    // Team filter for monthly metrics
    const filterTeamMonthly = document.getElementById('filterTeamMonthly');
    if (filterTeamMonthly) {
      filterTeamMonthly.addEventListener('change', () => this.loadMonthlyMetrics());
    }

    // Connection hours filters
    const filterMonthConnectionHours = document.getElementById('filterMonthConnectionHours');
    if (filterMonthConnectionHours) {
      filterMonthConnectionHours.addEventListener('change', () => this.loadConnectionHours());
    }

    const filterTeamConnectionHours = document.getElementById('filterTeamConnectionHours');
    if (filterTeamConnectionHours) {
      filterTeamConnectionHours.addEventListener('change', () => this.loadConnectionHours());
    }

    // Statistics filters
    const filterMonthStats = document.getElementById('filterMonthStats');
    if (filterMonthStats) {
      filterMonthStats.addEventListener('change', () => this.loadStatistics());
    }

    const filterTeamStats = document.getElementById('filterTeamStats');
    if (filterTeamStats) {
      filterTeamStats.addEventListener('change', () => {
        this.updateAgentStatsFilter();
        this.loadStatistics();
      });
    }

    const filterAgentStats = document.getElementById('filterAgentStats');
    if (filterAgentStats) {
      filterAgentStats.addEventListener('change', () => this.loadStatistics());
    }

    // Team quality selector for dashboard
    const teamQualitySelector = document.getElementById('teamQualitySelector');
    if (teamQualitySelector) {
      teamQualitySelector.addEventListener('change', () => this.loadTeamQualityMetrics());
    }

    // Close modal on overlay click
    const auditModal = document.getElementById('auditModal');
    if (auditModal) {
      auditModal.addEventListener('click', (e) => {
        if (e.target === auditModal) {
          this.closeAuditModal();
        }
      });
    }

    // View modal close button
    const closeViewModalBtn = document.getElementById('closeViewModalBtn');
    if (closeViewModalBtn) {
      closeViewModalBtn.addEventListener('click', () => this.closeViewModal());
    }

    // Close view modal on overlay click
    const auditViewModal = document.getElementById('auditViewModal');
    if (auditViewModal) {
      auditViewModal.addEventListener('click', (e) => {
        if (e.target === auditViewModal) {
          this.closeViewModal();
        }
      });
    }

    // Week configuration modal
    // Use event delegation to ensure button works even if DOM changes
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest('#configWeeksBtn')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.openWeekConfigModal();
      }
      // Excel import button
      if (e.target && e.target.closest('#excelImportBtn')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.openExcelImportModal();
      }
      // Connection hours import button
      if (e.target && e.target.closest('#importConnectionHoursBtn')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.openConnectionHoursImportModal();
      }
      if (e.target && e.target.closest('#dangerClearDataBtn')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.handleClearData();
      }
    });

    const closeWeekConfigBtn = document.getElementById('closeWeekConfigBtn');
    const cancelWeekConfigBtn = document.getElementById('cancelWeekConfigBtn');
    if (closeWeekConfigBtn) {
      closeWeekConfigBtn.addEventListener('click', () => this.closeWeekConfigModal());
    }
    if (cancelWeekConfigBtn) {
      cancelWeekConfigBtn.addEventListener('click', () => this.closeWeekConfigModal());
    }

    const saveWeekConfigBtn = document.getElementById('saveWeekConfigBtn');
    if (saveWeekConfigBtn) {
      saveWeekConfigBtn.addEventListener('click', () => this.saveWeekConfig());
    }

    // Manual metrics modal
    const closeManualMetricsBtn = document.getElementById('closeManualMetricsBtn');
    const cancelManualMetricsBtn = document.getElementById('cancelManualMetricsBtn');
    if (closeManualMetricsBtn) {
      closeManualMetricsBtn.addEventListener('click', () => this.closeManualMetricsModal());
    }
    if (cancelManualMetricsBtn) {
      cancelManualMetricsBtn.addEventListener('click', () => this.closeManualMetricsModal());
    }

    const manualMetricsForm = document.getElementById('manualMetricsForm');
    if (manualMetricsForm) {
      manualMetricsForm.addEventListener('submit', (e) => this.handleManualMetricsSubmit(e));
    }

    // Add member modal
    const closeAddMemberBtn = document.getElementById('closeAddMemberBtn');
    const cancelAddMemberBtn = document.getElementById('cancelAddMemberBtn');
    if (closeAddMemberBtn) {
      closeAddMemberBtn.addEventListener('click', () => this.closeAddMemberModal());
    }
    if (cancelAddMemberBtn) {
      cancelAddMemberBtn.addEventListener('click', () => this.closeAddMemberModal());
    }

    const addMemberForm = document.getElementById('addMemberForm');
    if (addMemberForm) {
      addMemberForm.addEventListener('submit', (e) => this.handleAddMemberSubmit(e));
    }

    const addMemberModal = document.getElementById('addMemberModal');
    if (addMemberModal) {
      addMemberModal.addEventListener('click', (e) => {
        if (e.target === addMemberModal) {
          this.closeAddMemberModal();
        }
      });
    }
    
    // Keyboard navigation for table scrolling
    this.setupTableKeyboardNavigation();

    // Close modals on overlay click
    const weekConfigModal = document.getElementById('weekConfigModal');
    if (weekConfigModal) {
      weekConfigModal.addEventListener('click', (e) => {
        if (e.target === weekConfigModal) {
          this.closeWeekConfigModal();
        }
      });
    }

    const manualMetricsModal = document.getElementById('manualMetricsModal');
    if (manualMetricsModal) {
      manualMetricsModal.addEventListener('click', (e) => {
        if (e.target === manualMetricsModal) {
          this.closeManualMetricsModal();
        }
      });
    }
  },
  
  // Setup keyboard navigation for table scrolling
  setupTableKeyboardNavigation() {
    // Track last interacted table-scroll so arrows work even without focus
    this._lastTableScroll = this._lastTableScroll || null;

    // Add event listeners to all .table-scroll elements
    document.addEventListener('keydown', (e) => {
      const activeElement = document.activeElement;
      
      // Check if a table-scroll element or its child has focus
      const tableScroll = activeElement.classList.contains('table-scroll') 
        ? activeElement 
        : activeElement.closest('.table-scroll');

      const effectiveTableScroll = tableScroll || this._lastTableScroll;
      
      if (effectiveTableScroll) {
        const scrollAmount = 50; // pixels to scroll
        
        switch(e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            effectiveTableScroll.scrollLeft -= scrollAmount;
            break;
          case 'ArrowRight':
            e.preventDefault();
            effectiveTableScroll.scrollLeft += scrollAmount;
            break;
          case 'ArrowUp':
            e.preventDefault();
            effectiveTableScroll.scrollTop -= scrollAmount;
            break;
          case 'ArrowDown':
            e.preventDefault();
            effectiveTableScroll.scrollTop += scrollAmount;
            break;
        }
      }
    });
    
    // Make table-scroll elements focusable and add wheel-to-horizontal-scroll
    const makeTablesFocusable = () => {
      const tables = document.querySelectorAll('.table-scroll');
      tables.forEach(table => {
        if (!table.hasAttribute('tabindex')) {
          table.setAttribute('tabindex', '0');
        }

        // Track last active table and focus on interaction
        if (!table.dataset.trackBound) {
          table.dataset.trackBound = '1';
          table.addEventListener('mouseenter', () => { this._lastTableScroll = table; });
          table.addEventListener('pointerdown', () => {
            this._lastTableScroll = table;
            table.focus({ preventScroll: true });
          });
        }

        // Convert mouse wheel to horizontal scroll when horizontal overflow exists
        if (!table.dataset.wheelXBound) {
          table.dataset.wheelXBound = '1';
          table.addEventListener('wheel', (e) => {
            // Only if there is horizontal overflow
            const canScrollX = table.scrollWidth > table.clientWidth;
            if (!canScrollX) return;

            // If user is already doing horizontal scroll (trackpad), let it be
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

            // Use vertical wheel to scroll horizontally
            if (e.deltaY !== 0) {
              e.preventDefault();
              table.scrollLeft += e.deltaY;
            }
          }, { passive: false });
        }
      });
    };
    
    // Run initially and on view changes
    makeTablesFocusable();
    
    // Use MutationObserver to detect when tables are added to DOM
    const observer = new MutationObserver(makeTablesFocusable);
    observer.observe(document.body, { childList: true, subtree: true });
  },

  // Setup sticky agent names that follow horizontal scroll
  setupStickyAgentNames() {
    // Find all table-scroll containers in weekly metrics view
    const weeklyView = document.getElementById('metricsWeeklyView');
    if (!weeklyView) return;

    const tableScrolls = weeklyView.querySelectorAll('.table-scroll');
    
    tableScrolls.forEach(scrollContainer => {
      // Remove any existing scroll listener to avoid duplicates
      if (scrollContainer._stickyScrollHandler) {
        scrollContainer.removeEventListener('scroll', scrollContainer._stickyScrollHandler);
      }

      // Create scroll handler
      const scrollHandler = () => {
        const scrollLeft = scrollContainer.scrollLeft;
        const table = scrollContainer.querySelector('.data-table');
        
        if (!table) return;

        // Get all first column cells (agent names)
        const firstColCells = table.querySelectorAll('th:first-child, td:first-child');
        
        // Update the left position of sticky columns based on scroll
        // The names will move with the scroll to stay visible
        firstColCells.forEach(cell => {
          cell.style.left = `${scrollLeft}px`;
        });
      };

      // Attach the handler
      scrollContainer.addEventListener('scroll', scrollHandler, { passive: true });
      
      // Store reference to remove it later if needed
      scrollContainer._stickyScrollHandler = scrollHandler;
    });
  },

  // Authentication handlers
  handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('emailInput').value;
    const user = DataManager.login(email);
    this.showMainApp(user);
  },

  handleLogout() {
    if (confirm('¿Está seguro que desea cerrar sesión?')) {
      DataManager.logout();
      this.showAuthScreen();
    }
  },

  handleClearSession() {
    if (confirm('¿Está seguro que desea limpiar todos los datos y la sesión? Esta acción no se puede deshacer.')) {
      // Clear all persisted app data
      DataManager.resetStorage();
      // Reinitialize data
      DataManager.init();
      // Show auth screen
      this.showAuthScreen();
      // Clear email input
      const emailInput = document.getElementById('emailInput');
      if (emailInput) {
        emailInput.value = '';
      }
      alert('Sesión y datos limpiados exitosamente. Por favor, inicie sesión nuevamente.');
    }
  },

  handleClearData() {
    if (confirm('Esto borrará temporalmente todos los datos y reiniciará la app. ¿Continuar?')) {
      DataManager.resetStorage();
      DataManager.init();
      this.populateMonthSelectors();
      this.showAuthScreen();
      alert('Datos borrados (uso temporal). Inicie sesión para continuar.');
    }
  },

  showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
  },

  showMainApp(user) {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');

    // Update user info
    document.getElementById('userEmail').textContent = user.email;
    const roleBadge = document.getElementById('userRoleBadge');
    const viewerOnlyEls = document.querySelectorAll('.only-viewer');
    const userTeam = DataManager.getUserTeam();
    
    if (user.role === 'admin') {
      roleBadge.textContent = 'Administrador';
      roleBadge.className = 'badge badge-admin';
      roleBadge.style.background = '#eab308';
      // Show all elements for admin
      document.querySelectorAll('.only-editor').forEach(el => {
        el.style.display = 'block';
      });
      viewerOnlyEls.forEach(el => {
        el.style.display = 'none';
      });
      const filterTeamWeekly = document.getElementById('filterTeamWeekly');
      if (filterTeamWeekly) {
        filterTeamWeekly.disabled = false;
      }
      document.querySelectorAll('.nav-btn[data-view="teams"]').forEach(el => {
        el.style.display = 'flex';
      });
    } else if (user.role === 'editor' || user.role === 'calidad') {
      roleBadge.textContent = 'Calidad';
      roleBadge.className = 'badge badge-calidad';
      roleBadge.style.background = '#38CEA6';
      // Show editor-only elements
      document.querySelectorAll('.only-editor').forEach(el => {
        el.style.display = 'block';
      });
      // Hide viewer-only elements for calidad
      viewerOnlyEls.forEach(el => {
        el.style.display = 'none';
      });
      const filterTeamWeekly = document.getElementById('filterTeamWeekly');
      if (filterTeamWeekly) {
        filterTeamWeekly.disabled = false;
      }
      // Show teams navigation for calidad
      document.querySelectorAll('.nav-btn[data-view="teams"]').forEach(el => {
        el.style.display = 'flex';
      });
    } else if (user.role === 'supervisor') {
      roleBadge.textContent = 'Supervisor';
      roleBadge.className = 'badge badge-supervisor';
      roleBadge.style.background = '#8b5cf6';
      // Supervisors can manage their own team
      document.querySelectorAll('.only-editor').forEach(el => {
        el.style.display = 'none';
      });
      // Show supervisor-specific elements
      document.querySelectorAll('.only-supervisor').forEach(el => {
        el.style.display = 'block';
      });
      viewerOnlyEls.forEach(el => {
        el.style.display = 'none';
      });
      // Show teams navigation for supervisor (only their team)
      document.querySelectorAll('.nav-btn[data-view="teams"]').forEach(el => {
        el.style.display = 'flex';
      });
      const filterTeamWeekly = document.getElementById('filterTeamWeekly');
      if (filterTeamWeekly) {
        // Mostrar contenedor del filtro aunque sea only-editor
        const weeklyFilterContainer = filterTeamWeekly.closest('.only-editor');
        if (weeklyFilterContainer) weeklyFilterContainer.style.display = 'block';
        if (userTeam) filterTeamWeekly.value = userTeam;
        // Permitir cambiar el equipo para supervisores
        filterTeamWeekly.disabled = false;
      }
      // Horas de conexión: mostrar y habilitar filtro de equipo
      const filterTeamConnectionHours = document.getElementById('filterTeamConnectionHours');
      if (filterTeamConnectionHours) {
        const connFilterContainer = filterTeamConnectionHours.closest('.only-editor');
        if (connFilterContainer) connFilterContainer.style.display = 'block';
        if (userTeam) filterTeamConnectionHours.value = userTeam;
        filterTeamConnectionHours.disabled = false;
      }
      this.populateMonthSelectors();
    } else if (user.role === 'analista') {
      roleBadge.textContent = 'Analista';
      roleBadge.className = 'badge badge-analista';
      roleBadge.style.background = '#06b6d4';
      // Analistas have same permissions as supervisors
      document.querySelectorAll('.only-editor').forEach(el => {
        el.style.display = 'none';
      });
      document.querySelectorAll('.only-supervisor').forEach(el => {
        el.style.display = 'block';
      });
      viewerOnlyEls.forEach(el => {
        el.style.display = 'none';
      });
      document.querySelectorAll('.nav-btn[data-view="teams"]').forEach(el => {
        el.style.display = 'flex';
      });
      const filterTeamWeekly = document.getElementById('filterTeamWeekly');
      if (filterTeamWeekly) {
        // Mostrar contenedor del filtro aunque sea only-editor
        const weeklyFilterContainer = filterTeamWeekly.closest('.only-editor');
        if (weeklyFilterContainer) weeklyFilterContainer.style.display = 'block';
        if (userTeam) filterTeamWeekly.value = userTeam;
        // Permitir cambiar el equipo para analistas
        filterTeamWeekly.disabled = false;
      }
      // Horas de conexión: mostrar y habilitar filtro de equipo
      const filterTeamConnectionHours = document.getElementById('filterTeamConnectionHours');
      if (filterTeamConnectionHours) {
        const connFilterContainer = filterTeamConnectionHours.closest('.only-editor');
        if (connFilterContainer) connFilterContainer.style.display = 'block';
        if (userTeam) filterTeamConnectionHours.value = userTeam;
        filterTeamConnectionHours.disabled = false;
      }
      this.populateMonthSelectors();
    } else {
      roleBadge.textContent = 'Usuario';
      roleBadge.className = 'badge badge-viewer';
      // Hide editor-only elements
      document.querySelectorAll('.only-editor').forEach(el => {
        el.style.display = 'none';
      });
      // Hide teams navigation for regular users
      document.querySelectorAll('.nav-btn[data-view="teams"]').forEach(el => {
        el.style.display = 'none';
      });
      // Show viewer-only elements for lectores
      viewerOnlyEls.forEach(el => {
        const isTableCell = el.tagName === 'TD' || el.tagName === 'TH';
        el.style.display = isTableCell ? 'table-cell' : 'block';
      });
      // Restringir filtros a su equipo en métricas semanales
      const filterTeamWeekly = document.getElementById('filterTeamWeekly');
      if (filterTeamWeekly) {
        if (userTeam) {
          filterTeamWeekly.value = userTeam;
        }
        filterTeamWeekly.disabled = true;
      }
      this.populateMonthSelectors();
    }

    // Show/hide statistics navigation for editors, supervisors, and analysts
    const statsNavBtn = document.querySelectorAll('.nav-btn[data-view="statistics"]');
    const canAccessStats = user.role === 'admin' || user.role === 'editor' || user.role === 'calidad' || user.role === 'supervisor' || user.role === 'analista';
    statsNavBtn.forEach(el => {
      el.style.display = canAccessStats ? 'flex' : 'none';
    });

    // Show/hide stats team filter based on role
    const statsTeamFilter = document.querySelector('.stats-team-filter');
    if (statsTeamFilter) {
      if (user.role === 'admin' || user.role === 'editor' || user.role === 'calidad') {
        statsTeamFilter.style.display = 'block';
      } else if (user.role === 'supervisor' || user.role === 'analista') {
        // Show filter for supervisors/analysts but they can change teams
        statsTeamFilter.style.display = 'block';
      } else {
        statsTeamFilter.style.display = 'none';
      }
    }

    // Initialize team dropdowns
    this.initializeTeamFilters();

    // Initialize OverlayScrollbars for smooth scrolling
    this.initializeOverlayScrollbars();

    // Load initial view
    this.switchView('dashboard');
  },

  initializeTeamFilters() {
    const teams = DataManager.getAllTeams();
    
    // Populate weekly metrics team filter
    const filterTeamWeekly = document.getElementById('filterTeamWeekly');
    if (filterTeamWeekly) {
      // Clear existing options except the first one
      while (filterTeamWeekly.options.length > 1) {
        filterTeamWeekly.remove(1);
      }
      
      Object.values(teams).forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        filterTeamWeekly.appendChild(option);
      });
    }

    // Populate monthly metrics team filter
    const filterTeamMonthly = document.getElementById('filterTeamMonthly');
    if (filterTeamMonthly) {
      // Clear existing options except the first one
      while (filterTeamMonthly.options.length > 1) {
        filterTeamMonthly.remove(1);
      }
      
      Object.values(teams).forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        filterTeamMonthly.appendChild(option);
      });
    }
  },

  initializeOverlayScrollbars() {
    // Nota: usamos scroll nativo en .table-scroll por compatibilidad (Windows)
    // y para evitar que el overlay oculte/capture el desplazamiento horizontal.
    return;
  },

  // View management
  switchView(viewName) {
    // Update active nav button
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      if (btn.getAttribute('data-view') === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
      view.classList.add('hidden');
    });

    // Show selected view
    this.currentView = viewName;
    
    switch(viewName) {
      case 'dashboard':
        document.getElementById('dashboardView').classList.remove('hidden');
        this.loadDashboard();
        break;
      case 'audits':
        document.getElementById('auditsView').classList.remove('hidden');
        this.loadAuditsView();
        break;
      case 'teams':
        document.getElementById('teamsView').classList.remove('hidden');
        this.loadTeamsView();
        break;
      case 'metrics-weekly':
        document.getElementById('metricsWeeklyView').classList.remove('hidden');
        this.loadWeeklyMetrics();
        break;
      case 'metrics-monthly':
        document.getElementById('metricsMonthlyView').classList.remove('hidden');
        this.loadMonthlyMetrics();
        break;
      case 'connection-hours':
        document.getElementById('connectionHoursView').classList.remove('hidden');
        this.initializeConnectionHoursFilters();
        this.loadConnectionHours();
        break;
      case 'statistics':
        document.getElementById('statisticsView').classList.remove('hidden');
        this.initializeStatisticsFilters();
        this.loadStatistics();
        break;
    }
  },

  // Dashboard
  loadDashboard() {
    const user = DataManager.getCurrentUser();
    const userTeam = DataManager.getUserTeam();
    const isEditor = DataManager.isEditor();
    const allAudits = DataManager.getAllAudits();
    
    // For team users: filter to PERSONAL audits only (agentName matches current user's expected agent name)
    // For editors: show all audits
    let filteredAudits = allAudits;
    let personalAudits = [];
    
    if (userTeam && !isEditor) {
      const teams = DataManager.getAllTeams();
      const team = teams[userTeam];
      
      // Find which agent this user represents
      // Assuming user email maps to agent email
      let userAgentName = null;
      if (team && team.members) {
        const member = team.members.find(m => m.email === user.email);
        if (member) {
          userAgentName = member.name;
        }
      }
      
      // Filter to ONLY this user's personal audits
      if (userAgentName) {
        personalAudits = allAudits.filter(audit => audit.agentName === userAgentName);
        filteredAudits = personalAudits;
      } else {
        filteredAudits = [];
      }
    }
    
    const allMetrics = DataManager.calculateMetrics(filteredAudits);
    
    // Calculate this week's audits (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyAudits = filteredAudits.filter(audit => new Date(audit.date) >= oneWeekAgo);
    
    // Calculate quality accumulated this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyAudits = filteredAudits.filter(audit => {
      const auditDate = new Date(audit.date);
      return auditDate.getMonth() === currentMonth && auditDate.getFullYear() === currentYear;
    });
    const qualityThisMonth = monthlyAudits.length > 0
      ? Math.round(monthlyAudits.reduce((sum, a) => sum + parseFloat(a.score || 0), 0) / monthlyAudits.length)
      : 0;

    // Update summary stats
    document.getElementById('totalAuditsCount').textContent = allMetrics.total;
    document.getElementById('weeklyAuditsCount').textContent = weeklyAudits.length;
    
    // Change the third stat to show quality percentage
    const totalAgentsElement = document.getElementById('totalAgentsCount');
    if (totalAgentsElement) {
      const parentCard = totalAgentsElement.closest('.stat-card');
      if (parentCard) {
        const labelElement = parentCard.querySelector('.stat-label');
        if (labelElement) {
          labelElement.innerHTML = '<i class="fas fa-star"></i> % Calidad Acumulado Este Mes';
        }
        totalAgentsElement.textContent = qualityThisMonth + '%';
      }
    }

    // Load recent activity
    this.loadRecentActivity();

    // Load top agents
    this.loadTopAgents();

    // Load team quality metrics selector and initial display
    this.initializeTeamQualitySelector();
    this.loadTeamQualityMetrics();
    
    // Load quality comparison chart (only for team users)
    if (userTeam && !isEditor) {
      this.loadQualityComparisonChart();
    }
  },

  loadRecentActivity() {
    const user = DataManager.getCurrentUser();
    const userTeam = DataManager.getUserTeam();
    const isEditor = DataManager.isEditor();
    const hasSupervisorPerms = DataManager.hasSupervisorPermissions();
    const allAudits = DataManager.getAllAudits();
    const teams = DataManager.getAllTeams();

    const emailToName = (email) => {
      for (const team of Object.values(teams)) {
        const member = team.members?.find(m => m.email === email);
        if (member) return member.name;
      }
      return email;
    };

    const container = document.getElementById('recentActivity');

    // Supervisors/Analistas: show team audits + member add/remove activity for their team
    if (hasSupervisorPerms && !isEditor) {
      const teamAudits = userTeam ? allAudits.filter(a => a.teamId === userTeam) : [];
      const activityLog = DataManager.getActivityLog();
      const teamActivities = activityLog.filter(log => log.data?.teamId === userTeam);
      
      const auditEvents = teamAudits.map(audit => ({
        type: 'team_audit',
        ts: new Date(audit.createdAt || audit.date),
        audit
      }));

      const activityEvents = teamActivities.map(log => ({
        type: 'activity',
        ts: new Date(log.timestamp),
        activityType: log.type,
        data: log.data
      }));

      const events = [...auditEvents, ...activityEvents]
        .filter(e => e.ts && !isNaN(e.ts))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 6);

      if (!events.length) {
        container.innerHTML = '<p class="empty">No hay actividad reciente en su equipo</p>';
        return;
      }

      const roleLabel = (r) => r ? (r.charAt(0).toUpperCase() + r.slice(1)) : '';
      container.innerHTML = events.map(evt => {
        if (evt.type === 'activity') {
          if (evt.activityType === 'member_added') {
            return `
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.9rem; padding: 1rem; display: grid; gap: 0.5rem; margin-bottom: 0.4rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; color: #16a34a; font-weight: 700;">
                  <i class="fas fa-user-plus"></i>
                  <span>Nuevo integrante agregado</span>
                </div>
                <div style="font-size: 0.95rem; color: var(--text-primary);">
                  <strong>${evt.data.memberName}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                  <div style="font-size: 0.85rem; color: var(--text-muted);">Por: ${evt.data.addedBy || '-'}${evt.data.addedByRole ? ` (${roleLabel(evt.data.addedByRole)})` : ''}</div>
                  <span style="color: var(--text-muted); font-size: 0.8rem;">${evt.ts.toLocaleString()}</span>
                </div>
              </div>
            `;
          }
          if (evt.activityType === 'member_removed') {
            return `
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.9rem; padding: 1rem; display: grid; gap: 0.5rem; margin-bottom: 0.4rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; color: #dc2626; font-weight: 700;">
                  <i class="fas fa-user-minus"></i>
                  <span>Integrante eliminado</span>
                </div>
                <div style="font-size: 0.95rem; color: var(--text-primary);">
                  <strong>${evt.data.memberName}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                  <div style="font-size: 0.85rem; color: var(--text-muted);">Por: ${evt.data.removedBy || '-'}${evt.data.removedByRole ? ` (${roleLabel(evt.data.removedByRole)})` : ''}</div>
                  <span style="color: var(--text-muted); font-size: 0.8rem;">${evt.ts.toLocaleString()}</span>
                </div>
              </div>
            `;
          }
        }

        const audit = evt.audit;
        const scoreColor = audit.score >= 80 ? '#38CEA6' : audit.score >= 60 ? '#f59e0b' : '#ef4444';
        return `
          <div style=\"background: linear-gradient(135deg, #f0f9ff, #fff); border: 1px solid #bae6fd; border-radius: 0.9rem; padding: 1rem; display: grid; gap: 0.5rem; margin-bottom: 0.4rem;\">
            <div style=\"display: flex; align-items: center; gap: 0.5rem; color: #0284c7; font-weight: 700;\">
              <i class=\"fas fa-clipboard-check\"></i>
              <span>Se realizó una auditoría al usuario (${audit.agentName})</span>
            </div>
            <div style=\"display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;\">
              <div style=\"font-size: 0.95rem; color: var(--text-primary);\">
                Puntuación: <strong style=\"color: ${scoreColor};\">${audit.score}%</strong>
              </div>
              <button class=\"btn-mini\" style=\"background: #0284c7; color: white; border: none;\" onclick=\"App.viewAudit('${audit.id}')\">
                <i class=\"fas fa-eye\"></i> Ver auditoría
              </button>
            </div>
            <div style=\"color: var(--text-muted); font-size: 0.85rem;\">${DataManager.formatDate(audit.date)}</div>
          </div>
        `;
      }).join('');
      return;
    }

    if (!isEditor) {
      // Regular users: Actividad propia: auditorías y comentarios del agente
      let personalAudits = [];
      if (userTeam) {
        const team = teams[userTeam];
        const member = team?.members?.find(m => m.email === user.email);
        const userAgentName = member?.name;
        if (userAgentName) {
          personalAudits = allAudits.filter(audit => audit.agentName === userAgentName);
        }
      }

      const commentData = DataManager.getAllAuditComments();
      const myComments = Object.entries(commentData)
        .map(([auditId, data]) => ({ auditId, data }))
        .filter(entry => {
          const audit = allAudits.find(a => a.id === entry.auditId);
          return audit && audit.agentEmail === user.email;
        });

      const events = [
        ...personalAudits.map(audit => ({
          type: 'audit',
          ts: new Date(audit.createdAt || audit.date),
          audit
        })),
        ...myComments.map(entry => ({
          type: 'comment',
          ts: new Date(entry.data.timestamp),
          auditId: entry.auditId,
          comment: entry.data.comment
        }))
      ]
        .filter(e => e.ts && !isNaN(e.ts))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 4);

      if (!events.length) {
        container.innerHTML = '<p class="empty">No hay actividad reciente</p>';
        return;
      }

      container.innerHTML = events.map(evt => {
        if (evt.type === 'comment') {
          const audit = personalAudits.find(a => a.id === evt.auditId);
          return `
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 0.85rem; padding: 0.9rem; margin-bottom: 0.4rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; color: #c2410c; font-weight: 700;">
                  <i class="fas fa-comment-dots"></i> Comentaste tu auditoría
                </div>
                <span style="color: var(--text-muted); font-size: 0.8rem;">${evt.ts.toLocaleString()}</span>
              </div>
              <div style="margin-top: 0.4rem; color: var(--text-primary);">${evt.comment}</div>
              ${audit ? `<button class="btn-mini" style="margin-top: 0.6rem; background: #f59e0b; color: white; border: none;" onclick="App.viewAudit('${audit.id}')"><i class="fas fa-eye"></i> Ver auditoría</button>` : ''}
            </div>
          `;
        }

        const audit = evt.audit;
        const color = audit.score >= 80 ? '#38CEA6' : audit.score >= 60 ? '#f59e0b' : '#ef4444';
        return `
          <div style="background: linear-gradient(135deg, #ecfeff, #fff); border: 1px solid #e0f2fe; border-radius: 0.9rem; padding: 1rem; display: grid; gap: 0.5rem; margin-bottom: 0.4rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; color: #0ea5e9; font-weight: 700;">
              <i class="fas fa-bell"></i>
              <span>Se registró una auditoría</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div style="font-size: 0.95rem; color: var(--text-primary);">
                Tu puntuación es <strong style="color: ${color};">${audit.score}%</strong>
              </div>
              <button class="btn-mini" style="background: #0ea5e9; color: white; border: none;" onclick="App.viewAudit('${audit.id}')">
                <i class="fas fa-eye"></i> Ver auditoría
              </button>
            </div>
            <div style="color: var(--text-muted); font-size: 0.85rem;">${DataManager.formatDate(audit.date)}</div>
          </div>
        `;
      }).join('');
      return;
    }

    // Editor: mezcla auditorías, comentarios, and activity logs
    const auditEvents = allAudits.map(audit => ({
      type: 'audit',
      ts: new Date(audit.createdAt || audit.date),
      audit
    }));

    const commentData = DataManager.getAllAuditComments();
    const commentEvents = Object.entries(commentData).map(([auditId, data]) => ({
      type: 'comment',
      ts: new Date(data.timestamp),
      auditId,
      agentEmail: data.agentEmail,
      comment: data.comment
    }));

    // Get activity log entries (supervisor added/removed members)
    const activityLog = DataManager.getActivityLog();
    const activityEvents = activityLog.map(log => ({
      type: 'activity',
      ts: new Date(log.timestamp),
      activityType: log.type,
      data: log.data
    }));

    const events = [...auditEvents, ...commentEvents, ...activityEvents]
      .filter(e => e.ts && !isNaN(e.ts))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 10);

    if (!events.length) {
      container.innerHTML = '<p class="empty">No hay actividad reciente</p>';
      return;
    }

    container.innerHTML = events.map(evt => {
      if (evt.type === 'activity') {
        const teamName = teams[evt.data.teamId]?.name || 'Equipo';
        const roleLabel = (r) => r ? (r.charAt(0).toUpperCase() + r.slice(1)) : '';
        if (evt.activityType === 'member_added') {
          return `
            <div style="padding: 0.75rem; border-radius: 0.75rem; background: #f0fdf4; border: 1px solid #bbf7d0; margin-bottom: 0.35rem;">
              <div style="display: flex; justify-content: space-between; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; color: #16a34a; font-weight: 700;">
                  <i class="fas fa-user-plus"></i>
                  <span>Nuevo integrante agregado</span>
                </div>
                <span style="color: var(--text-muted); font-size: 0.8rem;">${evt.ts.toLocaleString()}</span>
              </div>
              <div style="margin-top: 0.4rem; color: var(--text-primary);">
                <strong>${evt.data.memberName}</strong> fue agregado a ${teamName}
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Por: ${emailToName(evt.data.addedBy)}${evt.data.addedByRole ? ` (${roleLabel(evt.data.addedByRole)})` : ''}</div>
            </div>
          `;
        } else if (evt.activityType === 'member_removed') {
          return `
            <div style="padding: 0.75rem; border-radius: 0.75rem; background: #fef2f2; border: 1px solid #fecaca; margin-bottom: 0.35rem;">
              <div style="display: flex; justify-content: space-between; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; color: #dc2626; font-weight: 700;">
                  <i class="fas fa-user-minus"></i>
                  <span>Integrante eliminado</span>
                </div>
                <span style="color: var(--text-muted); font-size: 0.8rem;">${evt.ts.toLocaleString()}</span>
              </div>
              <div style="margin-top: 0.4rem; color: var(--text-primary);">
                <strong>${evt.data.memberName}</strong> fue eliminado de ${teamName}
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Por: ${emailToName(evt.data.removedBy)}${evt.data.removedByRole ? ` (${roleLabel(evt.data.removedByRole)})` : ''}</div>
            </div>
          `;
        }
        return '';
      }

      if (evt.type === 'comment') {
        const audit = allAudits.find(a => a.id === evt.auditId);
        const agentName = audit?.agentName || emailToName(evt.agentEmail);
        return `
          <div style="padding: 0.75rem; border-radius: 0.75rem; background: #fff7ed; border: 1px solid #fed7aa; margin-bottom: 0.35rem;">
            <div style="display: flex; justify-content: space-between; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; color: #c2410c; font-weight: 700;">
                <i class="fas fa-comment-dots"></i>
                <span>Comentario de ${agentName || 'agente'}</span>
              </div>
              <span style="color: var(--text-muted); font-size: 0.8rem;">${evt.ts.toLocaleString()}</span>
            </div>
            <div style="margin-top: 0.4rem; color: var(--text-primary);">${evt.comment}</div>
            ${audit ? `<button class="btn-mini" style="margin-top: 0.5rem; background: #f59e0b; color: white; border: none;" onclick="App.viewAudit('${audit.id}')"><i class="fas fa-eye"></i> Ver auditoría</button>` : ''}
          </div>
        `;
      }


      const audit = evt.audit;
      const scoreColor = audit.score >= 80 ? '#38CEA6' : audit.score >= 60 ? '#f59e0b' : '#ef4444';
      return `
        <div style="padding: 0.75rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 0.35rem;">
          <div style="display: flex; justify-content: space-between; gap: 0.5rem; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.1rem;">📋</span>
              <div>
                <div style="font-weight: 700; color: var(--text-primary);">${audit.agentName}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">${DataManager.formatDate(audit.date)}</div>
              </div>
            </div>
            <div style="font-weight: 700; color: ${scoreColor};">${audit.score}%</div>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem;">${audit.type || 'Auditoría'} • ${audit.tipificacion || 'Sin tipificación'}</div>
        </div>
      `;
    }).join('');
  },

  loadTopAgents() {
    const user = DataManager.getCurrentUser();
    const userTeam = DataManager.getUserTeam();
    const isEditor = DataManager.isEditor();
    const isSupervisor = DataManager.isSupervisor();
    const isAnalista = DataManager.isAnalista();
    const hasSupervisorPerms = DataManager.hasSupervisorPermissions();
    const allAudits = DataManager.getAllAudits();
    const teams = DataManager.getAllTeams();
    
    // Filter audits to current month only
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const firstDayOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const lastDayString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;
    
    const currentMonthAudits = allAudits.filter(audit => {
      return audit.date >= firstDayOfMonth && audit.date <= lastDayString;
    });
    
    const container = document.getElementById('topAgents');
    
    // Update heading to show top 2 and bottom 3 with team filter
    const headingElement = container.parentElement.querySelector('h3');
    if (headingElement) {
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      headingElement.innerHTML = `<i class="fas fa-star"></i> Mejores y Puntos de Mejora - ${monthNames[currentMonth]} ${currentYear}`;
    }
    
    // Build filter options depending on role
    // Supervisors and Analistas can see all teams for comparison
    let filterOptions = '';
    let canSelectTeams = false;
    
    if (isEditor || hasSupervisorPerms) {
      // Editor, Supervisor, Analista can see all teams
      filterOptions = `
        <option value="all">Todos los Equipos</option>
        ${Object.entries(teams).map(([teamId, team]) => `
          <option value="${teamId}">${team.name}</option>
        `).join('')}
      `;
      canSelectTeams = true;
    } else if (userTeam && teams[userTeam]) {
      // Regular users only see their team (no dropdown)
      filterOptions = `<option value="${userTeam}">${teams[userTeam].name}</option>`;
      canSelectTeams = false;
    }

    // Add or refresh team filter dropdown
    const parentCard = container.closest('.glass') || container.parentElement;
    let filterContainer = parentCard ? parentCard.querySelector('.top-agents-filter') : null;
    if (!filterContainer && parentCard) {
      filterContainer = document.createElement('div');
      filterContainer.className = 'top-agents-filter';
      filterContainer.style.cssText = 'margin-bottom: 1rem;';
      filterContainer.innerHTML = `
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <label style="font-size: 0.9rem; font-weight: 600; color: var(--text-muted);">
            <i class="fas fa-filter"></i> ${canSelectTeams ? 'Filtrar por Equipo:' : 'Equipo:'}
          </label>
          <select id="topAgentsTeamFilter" class="input-dark" style="flex: 1; max-width: 300px;" ${!canSelectTeams ? 'disabled' : ''}>
            ${filterOptions}
          </select>
        </div>
      `;
      container.parentElement.insertBefore(filterContainer, container);

      if (canSelectTeams) {
        document.getElementById('topAgentsTeamFilter').addEventListener('change', () => {
          this.loadTopAgents();
        });
      }
    } else if (filterContainer) {
      const selectEl = filterContainer.querySelector('#topAgentsTeamFilter');
      if (selectEl) {
        // Preserve current selection before updating options
        const currentSelection = selectEl.value;
        selectEl.innerHTML = filterOptions;
        selectEl.disabled = !canSelectTeams;
        // Restore selection if it still exists in options
        if (currentSelection && Array.from(selectEl.options).some(opt => opt.value === currentSelection)) {
          selectEl.value = currentSelection;
        }
      }
    }
    
    // Get selected team filter
    const selectedTeamFilter = document.getElementById('topAgentsTeamFilter')?.value || 'all';
    
    // RBAC: Force regular users to their team filter, supervisors/analistas can select
    const effectiveTeamFilter = (!isEditor && !hasSupervisorPerms && userTeam) ? userTeam : selectedTeamFilter;
    
    // Helper function to calculate satisfaction percentage for an agent
    const calculateSatisfaction = (agentName) => {
      // Devuelve { pct, totalTickets } para saber si la satisfacción aplica
      return DataManager.calculateAgentSatisfaction(agentName, currentYear, currentMonth);
    };
    
    // Filter teams based on selection
    const teamsToShow = effectiveTeamFilter === 'all' 
      ? Object.entries(teams)
      : [[effectiveTeamFilter, teams[effectiveTeamFilter]]].filter(([_, t]) => t);
    
    // For editors: show top 2 and agents needing improvement from selected team(s)
    if (isEditor || userTeam) {
      const teamRankings = {};
      
      teamsToShow.forEach(([teamId, team]) => {
        const params = DataManager.getTeamManagementParams(teamId);
        const qualityMin = params?.qualityMinPct ?? 83;
        const satisfactionMin = params?.satisfactionMinPct ?? 90;

        // Filter out supervisors and analistas - they are not auditable
        const teamMemberNames = team.members 
          ? team.members.filter(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad').map(m => m.name) 
          : [];
        const teamAudits = currentMonthAudits.filter(audit => teamMemberNames.includes(audit.agentName));
        
        // Calculate agent scores with satisfaction
        const agentScores = {};
        teamAudits.forEach(audit => {
          if (!agentScores[audit.agentName]) {
            agentScores[audit.agentName] = { total: 0, count: 0 };
          }
          agentScores[audit.agentName].total += parseFloat(audit.score || 0);
          agentScores[audit.agentName].count++;
        });
        
        // Get all agents with both quality and satisfaction scores
        const allAgents = Object.entries(agentScores)
          .map(([name, data]) => {
            const sat = calculateSatisfaction(name);
            return {
              name,
              avgQuality: Math.round(data.total / data.count),
              satisfactionPct: sat.pct,
              satisfactionTickets: sat.totalTickets,
              count: data.count
            };
          });
        
        // Agents needing improvement: quality < min OR satisfaction < min
        const needsImprovement = allAgents
          .filter(agent => agent.avgQuality < qualityMin || (agent.satisfactionTickets > 0 && agent.satisfactionPct < satisfactionMin))
          .sort((a, b) => {
            // Sort by combined score (quality + satisfaction) ascending (worst first)
            const scoreA = a.avgQuality + (a.satisfactionTickets > 0 ? a.satisfactionPct : 100);
            const scoreB = b.avgQuality + (b.satisfactionTickets > 0 ? b.satisfactionPct : 100);
            return scoreA - scoreB;
          })
          .slice(0, 3); // Top 3 needing improvement
        
        // Top agents: exclude those needing improvement, then take top 2
        const excellentAgents = allAgents
          .filter(agent => !needsImprovement.find(n => n.name === agent.name))
          .sort((a, b) => b.avgQuality - a.avgQuality);
        
        const top2 = excellentAgents.slice(0, 2);
        
        teamRankings[teamId] = { team, top2, needsImprovement, params: { qualityMin, satisfactionMin } };
      });
      
      container.innerHTML = Object.entries(teamRankings).map(([teamId, data]) => {
        if (!data.top2.length && !data.needsImprovement.length) return '';
        
        return `
          <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid ${data.team.color};">
            <div style="font-weight: 700; color: ${data.team.color}; margin-bottom: 0.5rem;">
              ${data.team.name}
            </div>
            ${data.top2.length > 0 ? `
              <div style="margin-bottom: 0.5rem;">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">✨ TOP 2 MEJORES</div>
                ${data.top2.map((agent, index) => `
                  <div style="padding: 0.4rem 0; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <span style="font-size: 1.2rem; margin-right: 0.5rem;">${index === 0 ? '🥇' : '🥈'}</span>
                      <span style="font-weight: 600; color: var(--text-primary);">${agent.name}</span>
                      <span style="font-size: 0.85rem; color: var(--text-muted);"> • ${agent.count} auditorías</span>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-weight: 700; color: #38CEA6; font-size: 1rem;">
                        🎯 ${agent.avgQuality}%
                      </div>
                      <div style="font-size: 0.8rem; color: ${agent.satisfactionTickets > 0 ? 'var(--text-muted)' : '#9ca3af'};">
                        😊 ${agent.satisfactionTickets > 0 ? agent.satisfactionPct + '%' : '—'}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${(isEditor || hasSupervisorPerms) && data.needsImprovement.length > 0 ? `
              <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">📊 PUEDE MEJORAR (&lt;${data.params?.qualityMin ?? 83}% calidad o &lt;${data.params?.satisfactionMin ?? 90}% satisfacción)</div>
                ${data.needsImprovement.map((agent) => `
                  <div style="padding: 0.4rem 0; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <span style="font-size: 1rem; margin-right: 0.5rem;">📉</span>
                      <span style="font-weight: 600; color: var(--text-primary);">${agent.name}</span>
                      <span style="font-size: 0.85rem; color: var(--text-muted);"> • ${agent.count} auditorías</span>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-weight: 700; color: ${agent.avgQuality < (data.params?.qualityMin ?? 83) ? '#ef4444' : '#f59e0b'}; font-size: 1rem;">
                        🎯 ${agent.avgQuality}%
                      </div>
                      <div style="font-size: 0.8rem; color: ${agent.satisfactionTickets > 0 && agent.satisfactionPct < (data.params?.satisfactionMin ?? 90) ? '#ef4444' : 'var(--text-muted)'};">
                        😊 ${agent.satisfactionTickets > 0 ? agent.satisfactionPct + '%' : '—'}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
      
      if (container.innerHTML.trim() === '') {
        container.innerHTML = '<p class="empty">No hay datos disponibles para el equipo seleccionado</p>';
      }
    }
  },

  initializeTeamQualitySelector() {
    const selector = document.getElementById('teamQualitySelector');
    if (!selector) return;

    const teams = DataManager.getAllTeams();
    const userTeam = DataManager.getUserTeam();
    const isEditor = DataManager.isEditor();
    const hasSupervisorPerms = DataManager.hasSupervisorPermissions();
    
    // Clear and add options respecting role
    selector.innerHTML = '';
    if (isEditor || hasSupervisorPerms) {
      // Editors and supervisors/analistas can see all teams
      selector.innerHTML = '<option value="">Acumulado Global</option>';
      Object.entries(teams).forEach(([teamId, team]) => {
        const option = document.createElement('option');
        option.value = teamId;
        option.textContent = team.name;
        selector.appendChild(option);
      });
      selector.disabled = false;
    } else {
      // Regular users: solo su equipo
      if (userTeam && teams[userTeam]) {
        const option = document.createElement('option');
        option.value = userTeam;
        option.textContent = teams[userTeam].name;
        selector.appendChild(option);
        selector.value = userTeam;
        selector.disabled = true;
      } else {
        // Sin equipo asignado, mostrar global como fallback
        selector.innerHTML = '<option value="">Acumulado Global</option>';
        selector.disabled = true;
      }
    }
  },

  loadTeamQualityMetrics() {
    const selector = document.getElementById('teamQualitySelector');
    const content = document.getElementById('teamQualityContent');
    if (!selector || !content) return;

    const userTeam = DataManager.getUserTeam();
    const isEditor = DataManager.isEditor();
    const hasSupervisorPerms = DataManager.hasSupervisorPermissions();
    // En usuarios regulares, forzar al equipo asignado
    let selectedTeam = selector.value;
    if (!isEditor && !hasSupervisorPerms && userTeam) {
      selectedTeam = userTeam;
      selector.value = userTeam;
    }
    const allAudits = DataManager.getAllAudits();
    const teams = DataManager.getAllTeams();
    
    // Get current month audits
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthAudits = allAudits.filter(audit => {
      const auditDate = new Date(audit.date);
      return auditDate.getFullYear() === currentYear && auditDate.getMonth() === currentMonth;
    });

    if (selectedTeam === '' && isEditor) {
      // Show global accumulated metrics
      const teamMetrics = {};
      
      Object.entries(teams).forEach(([teamId, team]) => {
        const teamMemberNames = team.members ? team.members.map(m => m.name) : [];
        const teamAudits = currentMonthAudits.filter(audit => teamMemberNames.includes(audit.agentName));
        
        if (teamAudits.length > 0) {
          const avgQuality = Math.round(teamAudits.reduce((sum, a) => sum + parseFloat(a.score || 0), 0) / teamAudits.length);
          teamMetrics[teamId] = {
            team,
            count: teamAudits.length,
            avgQuality,
            agents: new Set(teamAudits.map(a => a.agentName)).size
          };
        }
      });

      content.innerHTML = `
        <div style="font-size: 0.9rem; margin-bottom: 1rem; color: var(--text-muted);">
          <i class="fas fa-globe"></i> Acumulado global de todos los equipos - ${now.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}
        </div>
        <div style="display: grid; gap: 1rem;">
          ${Object.entries(teamMetrics).map(([teamId, data]) => `
            <div style="background: ${data.team.color}15; border-left: 4px solid ${data.team.color}; padding: 1rem; border-radius: 0.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <h4 style="margin: 0; font-weight: 700; color: ${data.team.color};">${data.team.name}</h4>
                <div style="font-size: 1.5rem; font-weight: 700; color: ${data.team.color};">${data.avgQuality}%</div>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                <i class="fas fa-clipboard-check"></i> ${data.count} auditorías • 
                <i class="fas fa-users"></i> ${data.agents} agentes evaluados
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // Show detailed metrics for selected team
      const team = teams[selectedTeam];
      if (!team) return;

      const teamMemberNames = team.members ? team.members.map(m => m.name) : [];
      const teamAudits = currentMonthAudits.filter(audit => teamMemberNames.includes(audit.agentName));
      
      // Calculate per-agent metrics
      const agentMetrics = {};
      teamAudits.forEach(audit => {
        if (!agentMetrics[audit.agentName]) {
          agentMetrics[audit.agentName] = { count: 0, totalScore: 0, audits: [] };
        }
        agentMetrics[audit.agentName].count++;
        agentMetrics[audit.agentName].totalScore += parseFloat(audit.score || 0);
        agentMetrics[audit.agentName].audits.push(audit);
      });

      const sortedAgents = Object.entries(agentMetrics)
        .map(([name, data]) => ({
          name,
          count: data.count,
          avgScore: Math.round(data.totalScore / data.count)
        }))
        .sort((a, b) => b.avgScore - a.avgScore);

      const teamAvgQuality = teamAudits.length > 0
        ? Math.round(teamAudits.reduce((sum, a) => sum + parseFloat(a.score || 0), 0) / teamAudits.length)
        : 0;

      content.innerHTML = `
        <div style="background: ${team.color}15; border: 2px solid ${team.color}; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h4 style="margin: 0; font-weight: 700; font-size: 1.2rem; color: ${team.color};">
              <i class="fas fa-users"></i> ${team.name}
            </h4>
            <div>
              <div style="text-align: right;">
                <div style="font-size: 0.75rem; color: var(--text-muted);">PROMEDIO CALIDAD</div>
                <div style="font-size: 2rem; font-weight: 700; color: ${team.color};">${teamAvgQuality}%</div>
              </div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.9rem; color: var(--text-muted);">
            <div><i class="fas fa-clipboard-check"></i> <strong>${teamAudits.length}</strong> auditorías</div>
            <div><i class="fas fa-user-friends"></i> <strong>${sortedAgents.length}</strong> agentes evaluados</div>
            <div><i class="fas fa-calendar"></i> ${now.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
        
        <h5 style="font-weight: 700; color: var(--text-primary); margin: 0 0 0.75rem 0;">
          <i class="fas fa-chart-bar"></i> Detalle por Agente
        </h5>
        <div style="display: grid; gap: 0.5rem;">
          ${sortedAgents.map(agent => {
            const scoreColor = agent.avgScore >= 80 ? '#38CEA6' : agent.avgScore >= 60 ? '#f59e0b' : '#ef4444';
            return `
              <div style="background: white; border: 1px solid #e5e7eb; padding: 0.75rem; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 600; color: var(--text-primary);">${agent.name}</div>
                  <div style="font-size: 0.85rem; color: var(--text-muted);">
                    <i class="fas fa-clipboard-check"></i> ${agent.count} auditorías realizadas
                  </div>
                </div>
                <div style="font-size: 1.5rem; font-weight: 700; color: ${scoreColor};">
                  ${agent.avgScore}%
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  },
  
  loadQualityComparisonChart() {
    const user = DataManager.getCurrentUser();
    const userTeam = DataManager.getUserTeam();
    const isEditor = DataManager.isEditor();
    const hasSupervisorPerms = DataManager.hasSupervisorPermissions();
    
    if (!userTeam || isEditor) {
      // Only for team users, not editors
      return;
    }
    
    const teams = DataManager.getAllTeams();
    const team = teams[userTeam];
    const allAudits = DataManager.getAllAudits();
    
    // Calculate team average quality (exclude supervisors/analistas from member names)
    const teamMemberNames = team && team.members 
      ? team.members.filter(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad').map(m => m.name) 
      : [];
    const teamAudits = allAudits.filter(audit => teamMemberNames.includes(audit.agentName));
    
    const teamQuality = teamAudits.length > 0 
      ? Math.round(teamAudits.reduce((sum, a) => sum + parseFloat(a.score || 0), 0) / teamAudits.length)
      : 0;
    
    // For supervisors/analistas: calculate other teams average
    // For regular users: calculate personal quality
    let primaryValue = 0;
    let primaryLabel = '';
    let secondaryLabel = '';
    let chartLabels = [];
    let chartData = [];
    let chartColors = [];
    
    if (hasSupervisorPerms) {
      // Supervisor/Analista: Show "Promedio de mi equipo" vs "Promedio de otros equipos"
      primaryValue = teamQuality;
      primaryLabel = 'Promedio de mi equipo';
      secondaryLabel = 'Promedio de otros equipos';
      
      // Calculate average of other teams
      let otherTeamsTotal = 0;
      let otherTeamsCount = 0;
      Object.entries(teams).forEach(([teamId, t]) => {
        if (teamId !== userTeam && t.members) {
          const otherMemberNames = t.members
            .filter(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad')
            .map(m => m.name);
          const otherAudits = allAudits.filter(a => otherMemberNames.includes(a.agentName));
          if (otherAudits.length > 0) {
            otherTeamsTotal += otherAudits.reduce((sum, a) => sum + parseFloat(a.score || 0), 0);
            otherTeamsCount += otherAudits.length;
          }
        }
      });
      
      const otherTeamsAvg = otherTeamsCount > 0 ? Math.round(otherTeamsTotal / otherTeamsCount) : 0;
      
      chartLabels = ['Mi Equipo', 'Otros Equipos', 'Meta (100%)'];
      chartData = [teamQuality, otherTeamsAvg, Math.max(0, 100 - Math.max(teamQuality, otherTeamsAvg))];
      chartColors = ['#38CEA6', '#f59e0b', '#e5e7eb'];
      
      // Build comparison text for supervisors
      var comparisonText = `
        Promedio de mi equipo: <strong style="color: #38CEA6; font-size: 1.2rem;">${teamQuality}%</strong><br>
        Promedio de otros equipos: <strong style="color: #f59e0b; font-size: 1.2rem;">${otherTeamsAvg}%</strong>
      `;
    } else {
      // Regular user: Show personal quality vs team average
      // Find which agent this user represents
      let userAgentName = null;
      if (team && team.members) {
        const member = team.members.find(m => m.email === user.email);
        if (member) {
          userAgentName = member.name;
        }
      }
      
      if (!userAgentName) return;
      
      // Calculate personal quality
      const personalAudits = allAudits.filter(audit => audit.agentName === userAgentName);
      const personalQuality = personalAudits.length > 0 
        ? Math.round(personalAudits.reduce((sum, a) => sum + parseFloat(a.score || 0), 0) / personalAudits.length)
        : 0;
      
      primaryValue = personalQuality;
      primaryLabel = 'Tu calidad';
      secondaryLabel = 'Promedio del equipo';
      
      chartLabels = ['Tu Calidad', 'Promedio del Equipo', 'Meta (100%)'];
      chartData = [personalQuality, teamQuality, Math.max(0, 100 - Math.max(personalQuality, teamQuality))];
      chartColors = ['#38CEA6', '#0ea5e9', '#e5e7eb'];
      
      // Build comparison text for regular users
      var comparisonText = `
        Tu calidad: <strong style="color: #38CEA6; font-size: 1.2rem;">${personalQuality}%</strong> vs 
        Promedio del equipo: <strong style="color: #0ea5e9; font-size: 1.2rem;">${teamQuality}%</strong>
      `;
    }
    
    // Check if chart already exists
    let chartContainer = document.getElementById('qualityComparisonChart');
    if (!chartContainer) {
      chartContainer = document.createElement('div');
      chartContainer.id = 'qualityComparisonChart';
      chartContainer.className = 'glass';
      chartContainer.style.cssText = 'padding: 1.5rem; margin-bottom: 1.5rem;';
      
      chartContainer.innerHTML = `
        <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 1rem 0;">
          <i class="fas fa-chart-pie"></i> Comparación de Calidad del Equipo
        </h3>
        <div style="max-width: 250px; margin: 0 auto;">
          <canvas id="qualityComparisonCanvas"></canvas>
        </div>
        <p style="text-align: center; margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted);">
          ${comparisonText}
        </p>
      `;
      
      // Insert next to "Resumen Rápido" - find the hero section
      const heroSection = document.querySelector('#dashboardView .hero');
      if (heroSection && heroSection.nextElementSibling) {
        heroSection.parentElement.insertBefore(chartContainer, heroSection.nextElementSibling);
      }
    } else {
      // Update existing chart text
      const textElement = chartContainer.querySelector('p');
      if (textElement) {
        textElement.innerHTML = comparisonText;
      }
    }
    
    // Render doughnut chart
    setTimeout(() => {
      const ctx = document.getElementById('qualityComparisonCanvas');
      if (!ctx) return;
      
      // Destroy existing chart
      if (this.charts.qualityComparison) {
        this.charts.qualityComparison.destroy();
      }
      
      this.charts.qualityComparison = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: chartLabels,
          datasets: [{
            data: chartData,
            backgroundColor: chartColors,
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                font: {
                  size: 11
                }
              }
            }
          },
          cutout: '65%'
        }
      });
    }, 100);
  },

  // Audits View
  loadAuditsView() {
    // Populate team filter
    const filterTeam = document.getElementById('filterTeam');
    if (filterTeam && filterTeam.options.length === 1) {
      const teams = DataManager.getAllTeams();
      Object.values(teams).forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        filterTeam.appendChild(option);
      });
    }
    
    this.filterAudits();
  },

  filterAudits() {
    const searchTerm = document.getElementById('searchAudit').value;
    const teamFilter = document.getElementById('filterTeam').value;
    const monthFilter = document.getElementById('filterMonth').value;
    
    let audits = DataManager.searchAudits(searchTerm, teamFilter);
    
    // Apply month filter
    if (monthFilter !== '') {
      const currentYear = new Date().getFullYear();
      const month = parseInt(monthFilter);
      audits = audits.filter(audit => {
        const auditDate = new Date(audit.date);
        return auditDate.getFullYear() === currentYear && auditDate.getMonth() === month;
      });
    }
    
    this.renderAuditsTable(audits);
  },

  renderAuditsTable(audits) {
    const tbody = document.getElementById('auditsTableBody');
    const isEditor = DataManager.isEditor();
    const teams = DataManager.getAllTeams();
    const comments = DataManager.getAllAuditComments();
    // Map criterion ids to human-readable labels for observation summary
    const criterionLabels = {
      // Empatía
      metodoRided: 'MÉTODO RIDED',
      lenguajePositivo: 'LENGUAJE POSITIVO',
      acompanamiento: 'ACOMPAÑAMIENTO',
      personalizacion: 'PERSONALIZACIÓN',
      estructura: 'ESTRUCTURA',
      usoIaOrtografia: 'USO DE IA/ORTOGRAFÍA',
      // Gestión – ticket
      estadosTicket: 'ESTADOS DEL TICKET',
      ausenciaCliente: 'AUSENCIA DEL CLIENTE',
      validacionHistorial: 'VALIDACIÓN DEL HISTORIAL',
      tipificacionCriterio: 'TIPIFICACIÓN',
      retencionTickets: 'RETENCIÓN DE TICKETS',
      tiempoRespuesta: 'TIEMPO DE RESPUESTA',
      tiempoGestion: 'TIEMPO DE GESTIÓN',
      // Gestión – conocimiento
      serviciosPromociones: 'SERVICIOS Y PROMOCIONES',
      informacionVeraz: 'INFORMACIÓN VERAZ',
      parlamentosContingencia: 'PARLAMENTOS DE CONTINGENCIA',
      honestidadTransparencia: 'HONESTIDAD Y TRANSPARENCIA',
      // Gestión – herramientas
      rideryOffice: 'RIDERY OFFICE',
      adminZendesk: 'ADMIN/ZENDESK',
      driveManuales: 'DRIVE Y MANUALES',
      slack: 'SLACK',
      generacionReportes: 'GENERACIÓN DE REPORTES',
      cargaIncidencias: 'CARGA DE INCIDENCIAS'
    };
    const emptyColspan = 12;
    
    if (audits.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${emptyColspan}" class="empty">No se encontraron auditorías</td></tr>`;
      return;
    }

    // Sort by date (newest first)
    const sortedAudits = audits.sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sortedAudits.map(audit => {
      const team = teams[audit.teamId];
      const teamName = team ? team.name : 'N/A';
      const teamColor = team ? team.color : '#6b7280';
      const empatiaScore = audit.empatiaScore || 0;
      const gestionScore = audit.gestionScore || 0;
      const totalScore = audit.score || 0;
      const tipificacion = audit.tipificacion || '-';
      const agentComment = comments[audit.id];
      // Estado de visualización basado en el agente dueño de la auditoría
      const hasViewed = audit.agentEmail
        ? DataManager.hasViewedAudit(audit.id, audit.agentEmail)
        : false;
      
      // Truncate long text for display but keep full text in title
      const truncate = (text, maxLen) => {
        if (!text || text === '-') return text;
        return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
      };
      const visualCell = isEditor ? `
          <td style="text-align: center; min-width: 120px;">
            <div style="display: inline-flex; gap: 0.4rem; align-items: center; justify-content: center;">
              ${(() => {
                if (!agentComment) {
                  return '<span title="Sin comentario del agente" style="color: var(--text-muted);"><i class="fas fa-cloud"></i></span>';
                }
                const commentText = agentComment.comment.replace(/`/g, '\\`');
                const content = `<div>${commentText}</div>`;
                return `<span title="Ver comentario del agente" style="color: #f59e0b; font-size: 1rem; cursor: pointer; display: inline-flex; align-items: center;" onclick="App.showObservationModal('Comentario del agente', \`${content}\`);"><i class=\"fas fa-cloud\"></i></span>`;
              })()}
              <span title="Estado de visualización" style="font-size: 1rem; color: ${hasViewed ? '#38CEA6' : '#94a3b8'};"><i class="fas fa-eye${hasViewed ? '' : '-slash'}"></i></span>
            </div>
          </td>` : '';
      // For integrantes: only show comment + eye icons (sin texto)
      const observationsCell = isEditor ? '' : `
          <td style="min-width: 120px; text-align: center;">
            <div style="display: inline-flex; gap: 0.4rem; align-items: center; justify-content: center;">
              ${(() => {
                if (!agentComment) {
                  return '<span title="Sin comentario del agente" style="color: var(--text-muted); font-size: 1rem;"><i class="fas fa-cloud"></i></span>';
                }
                const commentText = agentComment.comment.replace(/`/g, '\\`');
                const content = `<div>${commentText}</div>`;
                return `<span title="Ver comentario del agente" style="color: #f59e0b; font-size: 1rem; cursor: pointer; display: inline-flex; align-items: center;" onclick="App.showObservationModal('Comentario del agente', \`${content}\`);"><i class=\"fas fa-cloud\"></i></span>`;
              })()}
              <span title="Estado de visualización" style="font-size: 1rem; color: ${hasViewed ? '#38CEA6' : '#94a3b8'};"><i class="fas fa-eye${hasViewed ? '' : '-slash'}"></i></span>
            </div>
          </td>`;
      
      return `
        <tr>
          <td style="min-width: 140px;"><strong>${audit.agentName}</strong></td>
          <td style="min-width: 120px;"><span style="color: ${teamColor}; font-weight: 600; font-size: 0.85rem;">${teamName.replace('Soporte ', '')}</span></td>
          <td style="max-width: 140px; white-space: normal; font-size: 0.85rem;" title="${tipificacion}">${truncate(tipificacion, 30)}</td>
          <td style="min-width: 90px; font-size: 0.9rem;">${audit.ticketId || '-'}</td>
          <td style="min-width: 95px; font-size: 0.85rem;">${audit.ticketDate ? DataManager.formatDate(audit.ticketDate).replace(' de ', ' ') : '-'}</td>
          <td style="min-width: 95px; font-size: 0.85rem;">${DataManager.formatDate(audit.date).replace(' de ', ' ')}</td>
          <td style="text-align: center; min-width: 70px;"><strong style="color: #38CEA6; font-size: 0.95rem;">${empatiaScore}%</strong></td>
          <td style="text-align: center; min-width: 70px;"><strong style="color: #f59e0b; font-size: 0.95rem;">${gestionScore}%</strong></td>
          <td style="text-align: center; min-width: 60px;"><strong style="color: #10b981; font-size: 1rem;">${totalScore}</strong></td>
          <td style="min-width: 250px; max-width: 350px; white-space: normal; font-size: 0.85rem; line-height: 1.4;" title="${audit.ticketSummary || ''}">
            ${truncate(audit.ticketSummary, 100) || '-'}
          </td>
          ${visualCell}
          ${observationsCell}
          <td style="min-width: 200px; text-align: center;">
            <div style="display: flex; gap: 0.4rem; flex-wrap: nowrap; justify-content: center;">
              <button class="btn-mini" onclick="App.viewAudit('${audit.id}')" title="Ver detalles completos" style="background: #38CEA6; color: white; border: none; font-size: 0.8rem; padding: 0.35rem 0.6rem;">
                <i class="fas fa-eye"></i> Leer
              </button>
              ${isEditor ? `
                <button class="btn-mini" onclick="App.editAudit('${audit.id}')" title="Editar auditoría" style="background: #0ea5e9; color: white; border: none; font-size: 0.8rem; padding: 0.35rem 0.6rem;">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn-mini danger" onclick="App.deleteAudit('${audit.id}')" title="Eliminar auditoría" style="background: #ef4444; color: white; border: none; font-size: 0.8rem; padding: 0.35rem 0.6rem;">
                  <i class="fas fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // Teams Management View
  loadTeamsView() {
    const teams = DataManager.getAllTeams();
    const container = document.getElementById('teamsContainer');
    const isEditor = DataManager.isEditor();
    const hasSupervisorPerms = DataManager.hasSupervisorPermissions();
    const userTeam = DataManager.getUserTeam();
    const currentUser = DataManager.getCurrentUser();
    const isAdmin = DataManager.isAdmin();
    
    // For supervisors/analistas, only show their team
    let teamsToShow = Object.values(teams);
    if (hasSupervisorPerms && !isEditor && userTeam) {
      teamsToShow = teamsToShow.filter(team => team.id === userTeam);
    }
    
    container.innerHTML = teamsToShow.map(team => {
      const params = DataManager.getTeamManagementParams(team.id);
      const firstGood = params?.firstResponse?.goodMaxMin ?? 25;
      const resolGood = params?.resolution?.goodMaxMin ?? 60;
      const resolWarn = params?.resolution?.warnMaxMin ?? 90;
      const qualityMin = params?.qualityMinPct ?? 83;
      const satMin = params?.satisfactionMinPct ?? 90;

      return `
      <div class="glass" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 2px solid ${team.color};">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem 0; color: ${team.color};">
              <i class="fas fa-users"></i> ${team.name}
            </h3>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              <i class="fas fa-envelope"></i> ${team.email || 'No hay email configurado'}
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${isEditor ? `
              <button class="btn-accent" onclick="App.showAddSupervisorModal('${team.id}')" style="background: #8b5cf6; color: white; border: none; cursor: pointer; font-size: 0.85rem; padding: 0.5rem 1rem;">
                <i class="fas fa-user-shield"></i> Agregar Supervisor
              </button>
              <button class="btn-accent" onclick="App.showAddAnalistaModal('${team.id}')" style="background: #06b6d4; color: white; border: none; cursor: pointer; font-size: 0.85rem; padding: 0.5rem 1rem;">
                <i class="fas fa-chart-line"></i> Agregar Analista
              </button>
            ` : ''}
            <button class="btn-accent" onclick="App.showAddMemberModal('${team.id}')" style="background: ${team.color}; color: white; border: none; cursor: pointer; font-size: 0.85rem; padding: 0.5rem 1rem;">
              <i class="fas fa-plus"></i> Agregar Integrante
            </button>
          </div>
        </div>

        ${isEditor ? `
          <div style="margin: 0 0 1rem 0; padding: 0.75rem; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
              <div style="font-weight: 800; color: var(--text-primary);">
                <i class="fas fa-sliders-h"></i> Parámetros de gestión
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Se guardan por equipo</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.75rem;">
              <div>
                <label class="label-small">T. primera respuesta OK (min)</label>
                <input id="mp-fr-good-${team.id}" class="input-dark" type="number" min="0" step="1" value="${firstGood}" style="width: 100%;" />
              </div>
              <div>
                <label class="label-small">T. resolución OK (min)</label>
                <input id="mp-res-good-${team.id}" class="input-dark" type="number" min="0" step="1" value="${resolGood}" style="width: 100%;" />
              </div>
              <div>
                <label class="label-small">T. resolución A trabajar (min)</label>
                <input id="mp-res-warn-${team.id}" class="input-dark" type="number" min="0" step="1" value="${resolWarn}" style="width: 100%;" />
              </div>
              <div>
                <label class="label-small">Calidad mínima (%)</label>
                <input id="mp-quality-min-${team.id}" class="input-dark" type="number" min="0" max="100" step="1" value="${qualityMin}" style="width: 100%;" />
              </div>
              <div>
                <label class="label-small">Satisfacción mínima (%)</label>
                <input id="mp-sat-min-${team.id}" class="input-dark" type="number" min="0" max="100" step="1" value="${satMin}" style="width: 100%;" />
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 0.75rem;">
              <button class="btn-accent" onclick="App.saveTeamManagementParams('${team.id}')" style="background: ${team.color}; color: white; border: none; cursor: pointer; font-size: 0.85rem; padding: 0.45rem 0.9rem;">
                <i class="fas fa-save"></i> Guardar parámetros
              </button>
            </div>
          </div>
        ` : ''}
        
        <div style="display: grid; gap: 0.5rem;">
          ${team.members.length === 0 ? '<p class="empty">No hay integrantes en este equipo</p>' : ''}
          ${team.members.map(member => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f9fafb; border-radius: 0.5rem; border-left: 3px solid ${team.color};">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 600; color: var(--text-primary);">${member.name}</span>
                  ${member.role === 'calidad' ? '<span style="background: #38CEA6; color: white; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.7rem;">Calidad</span>' : ''}
                  ${member.role === 'supervisor' ? '<span style="background: #8b5cf6; color: white; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.7rem;">Supervisor</span>' : ''}
                  ${member.role === 'analista' ? '<span style="background: #06b6d4; color: white; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.7rem;">Analista</span>' : ''}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                  <i class="fas fa-envelope"></i> ${member.email}
                  ${member.shift ? `<span style="margin-left: 0.75rem;"><i class="fas fa-clock"></i> ${member.shift}</span>` : ''}
                  ${member.subTeam ? `<span style="margin-left: 0.75rem;"><i class="fas fa-sitemap"></i> ${member.subTeam}</span>` : ''}
                </div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn-mini" onclick="App.showEditMember('${team.id}', '${member.email}')" title="Editar" style="background: #e0f2fe; color: #0369a1;">
                  <i class="fas fa-edit"></i>
                </button>
              <button class="btn-mini danger" onclick="App.removeMember('${team.id}', '${member.email}')" title="Eliminar">
                <i class="fas fa-trash"></i>
              </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }).join('');
    
    // Add separate Calidad users section at the bottom (Admin y Calidad)
    if (isAdmin || isEditor) {
      const calidadUsers = this.getCalidadUsers();
      container.innerHTML += `
        <div class="glass" style="padding: 1.5rem; margin-top: 2rem; border: 2px solid #38CEA6;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 2px solid #38CEA6;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem 0; color: #38CEA6;">
                <i class="fas fa-clipboard-check"></i> Usuarios de Calidad
              </h3>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                <i class="fas fa-info-circle"></i> Usuarios con permisos de auditoría y gestión de métricas
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn-accent" onclick="App.showAddCalidadModal()" style="background: #38CEA6; color: white; border: none; cursor: pointer; font-size: 0.85rem; padding: 0.5rem 1rem;">
                <i class="fas fa-plus"></i> Agregar Calidad
              </button>
            </div>
          </div>
          
          <div style="display: grid; gap: 0.5rem;">
            ${calidadUsers.length === 0 ? '<p class="empty">No hay usuarios de Calidad registrados</p>' : ''}
            ${calidadUsers.map(user => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f0fdf4; border-radius: 0.5rem; border-left: 3px solid #38CEA6;">
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-weight: 600; color: var(--text-primary);">${user.name}</span>
                    <span style="background: #38CEA6; color: white; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.7rem;">Calidad</span>
                  </div>
                  <div style="font-size: 0.85rem; color: var(--text-muted);">
                    <i class="fas fa-envelope"></i> ${user.email}
                  </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn-mini danger" onclick="App.removeCalidadUser('${user.email}')" title="Eliminar">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  },

  saveTeamManagementParams(teamId) {
    if (!DataManager.isEditor()) return;

    const firstGood = parseFloat(document.getElementById(`mp-fr-good-${teamId}`)?.value);
    const resolGood = parseFloat(document.getElementById(`mp-res-good-${teamId}`)?.value);
    const resolWarn = parseFloat(document.getElementById(`mp-res-warn-${teamId}`)?.value);
    const qualityMin = parseFloat(document.getElementById(`mp-quality-min-${teamId}`)?.value);
    const satMin = parseFloat(document.getElementById(`mp-sat-min-${teamId}`)?.value);

    if ([firstGood, resolGood, resolWarn, qualityMin, satMin].some(v => isNaN(v) || v < 0)) {
      alert('Verifica los valores: deben ser números válidos (>= 0).');
      return;
    }

    DataManager.updateTeamManagementParams(teamId, {
      firstResponse: { goodMaxMin: firstGood },
      resolution: { goodMaxMin: resolGood, warnMaxMin: resolWarn },
      qualityMinPct: qualityMin,
      satisfactionMinPct: satMin
    });

    alert('Parámetros guardados correctamente.');
    this.loadTeamsView();
  },
  
  // Get all Calidad users from storage
  getCalidadUsers() {
    const calidadUsersStr = localStorage.getItem('ridery_calidad_users');
    return calidadUsersStr ? JSON.parse(calidadUsersStr) : [];
  },
  
  // Save Calidad users to storage
  saveCalidadUsers(users) {
    localStorage.setItem('ridery_calidad_users', JSON.stringify(users));
  },
  
  // Remove a Calidad user
  removeCalidadUser(email) {
    if (confirm(`¿Está seguro que desea eliminar este usuario de Calidad?`)) {
      const users = this.getCalidadUsers();
      const updatedUsers = users.filter(u => u.email !== email);
      this.saveCalidadUsers(updatedUsers);
      this.loadTeamsView();
      alert('Usuario de Calidad eliminado correctamente');
    }
  },

  showAddSupervisorModal(teamId) {
    const team = DataManager.getTeamById(teamId);
    if (!team) return;
    
    // Update modal title for supervisor
    const modalTitle = document.getElementById('addMemberModalTitle');
    if (modalTitle) {
      modalTitle.innerHTML = '<i class="fas fa-user-shield"></i> Agregar Supervisor';
    }
    
    // Set member type to supervisor
    document.getElementById('memberTeamId').value = teamId;
    document.getElementById('memberType').value = 'supervisor';
    document.getElementById('memberName').value = '';
    document.getElementById('memberEmail').value = '';
    document.getElementById('memberModalMode').value = 'add';
    document.getElementById('memberOriginalEmail').value = '';
    
    // Pre-select supervisor role and hide role selector (fixed to supervisor)
    const roleSelect = document.getElementById('memberRole');
    if (roleSelect) {
      roleSelect.value = 'supervisor';
    }
    const roleSection = document.getElementById('memberRoleSection');
    if (roleSection) {
      roleSection.style.display = 'none';
    }
    
    // Hide sub-team section for supervisors
    const subTeamSection = document.getElementById('subTeamSection');
    if (subTeamSection) {
      subTeamSection.style.display = 'none';
    }
    
    // Hide shift section for supervisors (supervisors don't need shifts)
    const shiftSection = document.getElementById('shiftSection');
    if (shiftSection) {
      shiftSection.style.display = 'none';
    }
    
    // Remove required attribute from shift radios
    document.querySelectorAll('input[name="memberShift"]').forEach(radio => {
      radio.required = false;
      radio.checked = false;
    });
    
    const submitBtn = document.querySelector('#addMemberForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Supervisor';
    }
    
    document.getElementById('addMemberModal').classList.remove('hidden');
  },

  showAddAnalistaModal(teamId) {
    const team = DataManager.getTeamById(teamId);
    if (!team) return;
    
    // Update modal title for analista
    const modalTitle = document.getElementById('addMemberModalTitle');
    if (modalTitle) {
      modalTitle.innerHTML = '<i class="fas fa-chart-line"></i> Agregar Analista';
    }
    
    // Set member type to analista
    document.getElementById('memberTeamId').value = teamId;
    document.getElementById('memberType').value = 'analista';
    document.getElementById('memberName').value = '';
    document.getElementById('memberEmail').value = '';
    document.getElementById('memberModalMode').value = 'add';
    document.getElementById('memberOriginalEmail').value = '';
    
    // Pre-select analista role and hide role selector (fixed to analista)
    const roleSelect = document.getElementById('memberRole');
    if (roleSelect) {
      roleSelect.value = 'analista';
    }
    const roleSection = document.getElementById('memberRoleSection');
    if (roleSection) {
      roleSection.style.display = 'none';
    }
    
    // Hide sub-team section for analistas
    const subTeamSection = document.getElementById('subTeamSection');
    if (subTeamSection) {
      subTeamSection.style.display = 'none';
    }
    
    // Hide shift section for analistas (analistas don't need shifts)
    const shiftSection = document.getElementById('shiftSection');
    if (shiftSection) {
      shiftSection.style.display = 'none';
    }
    
    // Remove required attribute from shift radios
    document.querySelectorAll('input[name="memberShift"]').forEach(radio => {
      radio.required = false;
      radio.checked = false;
    });
    
    const submitBtn = document.querySelector('#addMemberForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Analista';
    }
    
    document.getElementById('addMemberModal').classList.remove('hidden');
  },

  showAddCalidadModal() {
    // Show warning confirmation before proceeding
    const confirmed = confirm('⚠️ ADVERTENCIA\n\n¿Estás seguro de agregar un usuario con rol de Calidad?\n\nEste rol tendrá permisos para:\n• Crear, modificar y eliminar auditorías\n• Gestionar métricas semanales y mensuales\n• Agregar y eliminar integrantes de equipos\n\n¿Desea continuar?');
    
    if (!confirmed) return;
    
    // Update modal title for calidad
    const modalTitle = document.getElementById('addMemberModalTitle');
    if (modalTitle) {
      modalTitle.innerHTML = '<i class="fas fa-clipboard-check"></i> Agregar Usuario de Calidad';
    }
    
    // Set member type to calidad (no team needed)
    document.getElementById('memberTeamId').value = 'calidad-global';
    document.getElementById('memberType').value = 'calidad';
    document.getElementById('memberName').value = '';
    document.getElementById('memberEmail').value = '';
    document.getElementById('memberModalMode').value = 'add';
    document.getElementById('memberOriginalEmail').value = '';
    
    // Pre-select calidad role and hide role selector (fixed to calidad)
    const roleSelect = document.getElementById('memberRole');
    if (roleSelect) {
      roleSelect.value = 'calidad';
    }
    const roleSection = document.getElementById('memberRoleSection');
    if (roleSection) {
      roleSection.style.display = 'none';
    }
    
    // Hide sub-team section for calidad users
    const subTeamSection = document.getElementById('subTeamSection');
    if (subTeamSection) {
      subTeamSection.style.display = 'none';
    }
    
    // Hide shift section for calidad users (they don't need shifts)
    const shiftSection = document.getElementById('shiftSection');
    if (shiftSection) {
      shiftSection.style.display = 'none';
    }
    
    // Remove required attribute from shift radios
    document.querySelectorAll('input[name="memberShift"]').forEach(radio => {
      radio.required = false;
      radio.checked = false;
    });
    
    const submitBtn = document.querySelector('#addMemberForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Calidad';
    }
    
    document.getElementById('addMemberModal').classList.remove('hidden');
  },

  showAddMemberModal(teamId) {
    const team = DataManager.getTeamById(teamId);
    if (!team) return;
    
    // Update modal title for regular member
    const modalTitle = document.getElementById('addMemberModalTitle');
    if (modalTitle) {
      modalTitle.innerHTML = '<i class="fas fa-user-plus"></i> Agregar Integrante';
    }
    
    // Show modal
    document.getElementById('memberTeamId').value = teamId;
    document.getElementById('memberType').value = 'member';
    document.getElementById('memberName').value = '';
    document.getElementById('memberEmail').value = '';
    document.getElementById('memberModalMode').value = 'add';
    document.getElementById('memberOriginalEmail').value = '';
    
    // Reset role to user and show role selector
    const roleSelect = document.getElementById('memberRole');
    if (roleSelect) {
      roleSelect.value = 'viewer';
    }
    const roleSection = document.getElementById('memberRoleSection');
    if (roleSection) {
      roleSection.style.display = 'block';
    }
    
    // Show sub-team section for regular members
    const subTeamSection = document.getElementById('subTeamSection');
    if (subTeamSection) {
      subTeamSection.style.display = 'block';
    }
    
    // Clear sub-team
    const subTeamInput = document.getElementById('memberSubTeam');
    if (subTeamInput) {
      subTeamInput.value = '';
    }
    
    // Show shift section for regular members
    const shiftSection = document.getElementById('shiftSection');
    if (shiftSection) {
      shiftSection.style.display = 'block';
    }
    
    // Restore required attribute for shift radios
    document.querySelectorAll('input[name="memberShift"]').forEach(radio => {
      radio.required = true;
      radio.checked = false;
    });
    
    const submitBtn = document.querySelector('#addMemberForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Integrante';
    }
    
    document.getElementById('addMemberModal').classList.remove('hidden');
  },

  showEditMember(teamId, memberEmail) {
    const team = DataManager.getTeamById(teamId);
    if (!team || !team.members) return;

    const member = team.members.find(m => m.email === memberEmail);
    if (!member) return;

    // Update modal title
    const modalTitle = document.getElementById('addMemberModalTitle');
    if (modalTitle) {
      modalTitle.innerHTML = '<i class="fas fa-user-edit"></i> Editar Integrante';
    }

    document.getElementById('memberTeamId').value = teamId;
    document.getElementById('memberType').value = member.role || 'member';
    document.getElementById('memberName').value = member.name || '';
    document.getElementById('memberEmail').value = member.email || '';
    document.getElementById('memberModalMode').value = 'edit';
    document.getElementById('memberOriginalEmail').value = member.email;

    // Set role
    const roleSelect = document.getElementById('memberRole');
    if (roleSelect) {
      roleSelect.value = member.role || 'viewer';
    }
    
    // Set sub-team
    const subTeamInput = document.getElementById('memberSubTeam');
    if (subTeamInput) {
      subTeamInput.value = member.subTeam || '';
    }

    document.querySelectorAll('input[name="memberShift"]').forEach(radio => {
      radio.checked = radio.value === member.shift;
    });

    const submitBtn = document.querySelector('#addMemberForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
    }

    document.getElementById('addMemberModal').classList.remove('hidden');
  },

  closeAddMemberModal() {
    document.getElementById('addMemberModal').classList.add('hidden');
  },

  handleAddMemberSubmit(e) {
    e.preventDefault();
    
    const teamId = document.getElementById('memberTeamId').value;
    const name = document.getElementById('memberName').value.trim();
    const email = document.getElementById('memberEmail').value.toLowerCase().trim();
    const shift = document.querySelector('input[name="memberShift"]:checked')?.value;
    const mode = document.getElementById('memberModalMode').value || 'add';
    const originalEmail = document.getElementById('memberOriginalEmail').value;
    const memberType = document.getElementById('memberType')?.value || 'member';
    const role = document.getElementById('memberRole')?.value || 'viewer';
    const subTeam = document.getElementById('memberSubTeam')?.value?.trim() || null;
    
    // Get current user for activity logging
    const currentUser = DataManager.getCurrentUser();
    const addedBy = currentUser?.email;
    const addedByRole = currentUser?.role;
    
    // Supervisors, Analistas and Calidad don't require shift selection
    const isSupervisorType = memberType === 'supervisor' || role === 'supervisor';
    const isAnalistaType = memberType === 'analista' || role === 'analista';
    const isCalidadType = memberType === 'calidad' || role === 'calidad';
    const isSpecialRole = isSupervisorType || isAnalistaType || isCalidadType;
    
    if (!isSpecialRole && !shift) {
      alert('Por favor seleccione un turno');
      return;
    }
    
    // Handle Calidad users separately (they don't belong to a team)
    if (isCalidadType && teamId === 'calidad-global') {
      const calidadUsers = this.getCalidadUsers();
      // Check if email already exists
      if (calidadUsers.some(u => u.email === email)) {
        alert('Ya existe un usuario de Calidad con ese email');
        return;
      }
      calidadUsers.push({ name: name, email: email, role: 'calidad' });
      this.saveCalidadUsers(calidadUsers);
      this.closeAddMemberModal();
      this.loadTeamsView();
      alert('Usuario de Calidad agregado exitosamente');
      return;
    }
    
    // Build member data object
    let finalRole = role;
    if (isSupervisorType) finalRole = 'supervisor';
    if (isAnalistaType) finalRole = 'analista';
    if (isCalidadType) finalRole = 'calidad';
    
    const memberData = {
      name: name,
      email: email,
      role: finalRole
    };
    
    // Only add shift and subTeam for regular users (not supervisors/analistas/calidad)
    if (!isSpecialRole) {
      memberData.shift = shift;
      memberData.subTeam = subTeam;
    }
    
    let success = false;
    if (mode === 'edit') {
      success = DataManager.updateTeamMember(teamId, originalEmail, memberData);
    } else {
      success = DataManager.addTeamMember(teamId, memberData, addedBy, addedByRole);
    }
    
    if (success) {
      this.closeAddMemberModal();
      this.loadTeamsView();
      if (isSupervisorType) {
        alert(mode === 'edit' ? 'Supervisor actualizado correctamente' : 'Supervisor agregado exitosamente');
      } else if (isAnalistaType) {
        alert(mode === 'edit' ? 'Analista actualizado correctamente' : 'Analista agregado exitosamente');
      } else if (isCalidadType) {
        alert(mode === 'edit' ? 'Usuario de Calidad actualizado correctamente' : 'Usuario de Calidad agregado exitosamente');
      } else {
        alert(mode === 'edit' ? 'Integrante actualizado correctamente' : `Integrante agregado exitosamente al turno ${shift}`);
      }
    } else {
      alert('Error al guardar integrante');
    }
  },

  removeMember(teamId, memberEmail) {
    if (confirm(`¿Está seguro que desea eliminar este integrante del equipo?`)) {
      // Get current user for activity logging
      const currentUser = DataManager.getCurrentUser();
      const removedBy = currentUser?.email;
      const removedByRole = currentUser?.role;
      
      const success = DataManager.removeTeamMember(teamId, memberEmail, removedBy, removedByRole);
      if (success) {
        this.loadTeamsView();
      } else {
        alert('Error al eliminar integrante');
      }
    }
  },

  // Audit Modal
  openAuditModal(auditId = null) {
    const modal = document.getElementById('auditModal');
    const form = document.getElementById('auditForm');
    const modalTitle = document.getElementById('modalTitle');
    
    form.reset();
    
    // Reset all checkboxes
    document.querySelectorAll('input[type="checkbox"][name="empatia"], input[type="checkbox"][name="gestion"]').forEach(cb => {
      cb.checked = false;
    });
    
    // Populate agent dropdown (exclude supervisors, analistas, and calidad - they are not auditable)
    const agentSelect = document.getElementById('agentSelect');
    agentSelect.innerHTML = '<option value="">Seleccionar agente...</option>';
    
    const teams = DataManager.getAllTeams();
    Object.values(teams).forEach(team => {
        // Filter out supervisors, analistas, and calidad from the list
        const auditableMembers = team.members.filter(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad' && m.role !== 'calidad');
        if (auditableMembers.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = team.name;
        auditableMembers.forEach(member => {
          const option = document.createElement('option');
            option.value = JSON.stringify({ name: member.name, teamId: team.id, email: member.email });
          option.textContent = member.name;
          optgroup.appendChild(option);
        });
        agentSelect.appendChild(optgroup);
      }
    });
    
    if (auditId) {
      const audit = DataManager.getAuditById(auditId);
      if (audit) {
        modalTitle.textContent = 'Editar Auditoría de Chat';
        document.getElementById('auditId').value = audit.id;
        
        // Set agent select
        const agentData = JSON.stringify({ name: audit.agentName, teamId: audit.teamId });
        agentSelect.value = agentData;
        
        document.getElementById('ticketId').value = audit.ticketId || '';
        document.getElementById('ticketDate').value = audit.ticketDate || '';
        document.getElementById('auditDate').value = audit.date;
        document.getElementById('tipificacion').value = audit.tipificacion || '';
        document.getElementById('ticketSummary').value = audit.ticketSummary || '';
        document.getElementById('calculatedScore').value = audit.score || 0;
        
        // Load per-criterion observations if they exist
        if (audit.criterionObservations) {
          Object.keys(audit.criterionObservations).forEach(criterionId => {
            const obsField = document.querySelector(`#obs-${criterionId} textarea`);
            if (obsField) {
              obsField.value = audit.criterionObservations[criterionId];
              // Show the observation field
              const obsContainer = document.getElementById(`obs-${criterionId}`);
              if (obsContainer) {
                obsContainer.style.display = 'block';
              }
            }
          });
        }
        
        // Load evaluation data if exists
        if (audit.evaluationData) {
          // Empatía checkboxes
          if (audit.evaluationData.empatia) {
            Object.keys(audit.evaluationData.empatia).forEach(key => {
              if (audit.evaluationData.empatia[key]) {
                const checkbox = document.getElementById(key);
                if (checkbox) checkbox.checked = true;
              }
            });
          }
          
          // Gestión checkboxes
          if (audit.evaluationData.gestion) {
            ['ticket', 'conocimiento', 'herramientas'].forEach(category => {
              if (audit.evaluationData.gestion[category]) {
                Object.keys(audit.evaluationData.gestion[category]).forEach(key => {
                  if (audit.evaluationData.gestion[category][key]) {
                    const checkbox = document.getElementById(key);
                    if (checkbox) checkbox.checked = true;
                  }
                });
              }
            });
          }
        }
        
        // Recalculate score with loaded data
        this.calculateScore();
      }
    } else {
      modalTitle.textContent = 'Nueva Auditoría de Chat';
      document.getElementById('auditId').value = '';
      // Set today's date as default
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('auditDate').value = today;
      document.getElementById('ticketDate').value = today;
      document.getElementById('calculatedScore').value = 0;
      this.calculateScore();
    }
    
    modal.classList.remove('hidden');
  },

  closeAuditModal() {
    const modal = document.getElementById('auditModal');
    modal.classList.add('hidden');
    
    // Re-enable submit button
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Auditoría';
    }
    
    // Reset form
    document.getElementById('auditForm').reset();
    
    // Hide all observation fields
    document.querySelectorAll('.observation-field').forEach(field => {
      field.style.display = 'none';
      const textarea = field.querySelector('textarea');
      if (textarea) textarea.value = '';
    });
  },

  handleAuditSubmit(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn?.innerHTML;
    
    // Disable button temporarily
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }
    
    const auditId = document.getElementById('auditId').value;
    const agentSelectValue = document.getElementById('agentSelect').value;
    
    if (!agentSelectValue) {
      alert('Por favor seleccione un agente');
      // Re-enable button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
      return;
    }
    
    const agentData = JSON.parse(agentSelectValue);
    
    // Collect evaluation data
    const evaluationData = {
      empatia: {
        metodoRided: document.getElementById('metodoRided')?.checked || false,
        lenguajePositivo: document.getElementById('lenguajePositivo')?.checked || false,
        acompanamiento: document.getElementById('acompanamiento')?.checked || false,
        personalizacion: document.getElementById('personalizacion')?.checked || false,
        estructura: document.getElementById('estructura')?.checked || false,
        usoIaOrtografia: document.getElementById('usoIaOrtografia')?.checked || false
      },
      gestion: {
        ticket: {
          estadosTicket: document.getElementById('estadosTicket')?.checked || false,
          ausenciaCliente: document.getElementById('ausenciaCliente')?.checked || false,
          validacionHistorial: document.getElementById('validacionHistorial')?.checked || false,
          tipificacionCriterio: document.getElementById('tipificacionCriterio')?.checked || false,
          retencionTickets: document.getElementById('retencionTickets')?.checked || false,
          tiempoRespuesta: document.getElementById('tiempoRespuesta')?.checked || false,
          tiempoGestion: document.getElementById('tiempoGestion')?.checked || false
        },
        conocimiento: {
          serviciosPromociones: document.getElementById('serviciosPromociones')?.checked || false,
          informacionVeraz: document.getElementById('informacionVeraz')?.checked || false,
          parlamentosContingencia: document.getElementById('parlamentosContingencia')?.checked || false,
          honestidadTransparencia: document.getElementById('honestidadTransparencia')?.checked || false
        },
        herramientas: {
          rideryOffice: document.getElementById('rideryOffice')?.checked || false,
          adminZendesk: document.getElementById('adminZendesk')?.checked || false,
          driveManuales: document.getElementById('driveManuales')?.checked || false,
          slack: document.getElementById('slack')?.checked || false,
          generacionReportes: document.getElementById('generacionReportes')?.checked || false,
          cargaIncidencias: document.getElementById('cargaIncidencias')?.checked || false
        }
      }
    };
    
    // Collect per-criterion observations
    const criterionObservations = {};
    const allCriteria = [
      'metodoRided', 'lenguajePositivo', 'acompanamiento', 'personalizacion', 'estructura', 'usoIaOrtografia',
      'estadosTicket', 'ausenciaCliente', 'validacionHistorial', 'tipificacionCriterio', 'retencionTickets', 'tiempoRespuesta', 'tiempoGestion',
      'serviciosPromociones', 'informacionVeraz', 'parlamentosContingencia', 'honestidadTransparencia',
      'rideryOffice', 'adminZendesk', 'driveManuales', 'slack', 'generacionReportes', 'cargaIncidencias'
    ];
    
    allCriteria.forEach(criterionId => {
      const obsField = document.querySelector(`#obs-${criterionId} textarea`);
      if (obsField && obsField.value.trim()) {
        criterionObservations[criterionId] = obsField.value.trim();
      }
    });
    
    const auditData = {
      agentName: agentData.name,
      agentEmail: agentData.email || DataManager.getAgentEmailByName(agentData.name), // Ensure agent email is stored
      teamId: agentData.teamId,
      ticketId: document.getElementById('ticketId').value,
      ticketDate: document.getElementById('ticketDate').value,
      date: document.getElementById('auditDate').value,
      tipificacion: document.getElementById('tipificacion').value,
      ticketSummary: document.getElementById('ticketSummary').value,
      criterionObservations: criterionObservations, // Per-criterion observations
      score: parseFloat(document.getElementById('calculatedScore').value) || 0,
      empatiaScore: parseFloat(document.getElementById('empatiaScore').value) || 0,
      gestionScore: parseFloat(document.getElementById('gestionScore').value) || 0,
      evaluationData: evaluationData,
      type: 'Chat', // All audits are chat
      status: 'Completada'
    };

    if (auditId) {
      DataManager.updateAudit(auditId, auditData);
    } else {
      DataManager.createAudit(auditData);
    }

    this.closeAuditModal();
    
    // Refresh current view
    if (this.currentView === 'audits') {
      this.loadAuditsView();
    } else if (this.currentView === 'dashboard') {
      this.loadDashboard();
    }
  },

  editAudit(auditId) {
    this.openAuditModal(auditId);
  },

  deleteAudit(auditId) {
    if (confirm('¿Está seguro que desea eliminar esta auditoría?')) {
      DataManager.deleteAudit(auditId);
      this.loadAuditsView();
      
      // Refresh dashboard if that's the current view
      if (this.currentView === 'dashboard') {
        this.loadDashboard();
      }
    }
  },

  deleteAuditComment(auditId) {
    if (!DataManager.isEditor()) {
      alert('Solo los editores pueden borrar comentarios.');
      return;
    }
    const comments = DataManager.getAllAuditComments();
    if (!comments[auditId]) return;
    if (confirm('¿Eliminar el comentario de este agente?')) {
      delete comments[auditId];
      SafeStorage.setItem(DataManager.STORAGE_KEYS.AUDIT_COMMENTS, JSON.stringify(comments));
      this.viewAudit(auditId);
      this.loadRecentActivity();
    }
  },

  // View audit details
  viewAudit(auditId) {
    const audit = DataManager.getAuditById(auditId);
    if (!audit) return;

    const teams = DataManager.getAllTeams();
    const team = teams[audit.teamId];
    const teamName = team ? team.name : 'N/A';
    const currentUser = DataManager.getCurrentUser();
    const isEditor = DataManager.isEditor();

    // Mark view for activity and table eye status
    if (currentUser?.email) {
      DataManager.markAuditAsViewed(auditId, currentUser.email);
      this.loadRecentActivity();
    }

    // Build criteria display for Empatía
    const empatiaCriteria = {
      'metodoRided': 'MÉTODO RIDED',
      'lenguajePositivo': 'LENGUAJE POSITIVO',
      'acompanamiento': 'ACOMPAÑAMIENTO',
      'personalizacion': 'PERSONALIZACIÓN',
      'estructura': 'ESTRUCTURA',
      'usoIaOrtografia': 'USO DE IA, ORTOGRAFÍA Y EMOJIS'
    };

    let empatiaHTML = '<div style="display: grid; gap: 0.5rem;">';
    Object.entries(empatiaCriteria).forEach(([key, label]) => {
      const checked = audit.evaluationData?.empatia?.[key];
      const icon = checked ? '✓' : '✗';
      const color = checked ? '#38CEA6' : '#ef4444';
      const hasObservation = audit.criterionObservations && audit.criterionObservations[key];
      empatiaHTML += `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: ${checked ? '#f0fdf4' : '#fef2f2'}; border-radius: 0.5rem;">
          <span style="font-size: 1.2rem; color: ${color}; font-weight: bold;">${icon}</span>
          <span style="flex: 1; color: var(--text-primary);">${label}</span>
          ${hasObservation ? `
            <button class="btn-mini" onclick="App.showObservationModal('${label}', \`${hasObservation.replace(/`/g, '\\`')}\`); return false;" title="Ver observación" style="background: #f59e0b; color: white; border: none; font-size: 0.75rem; padding: 0.25rem 0.5rem; cursor: pointer;">
              <i class="fas fa-question-circle"></i>
            </button>
          ` : ''}
        </div>
      `;
    });
    empatiaHTML += '</div>';

    // Build criteria display for Gestión
    const gestionCategories = {
      'ticket': {
        title: 'Gestión de ticket',
        criteria: {
          'estadosTicket': 'Estados del Ticket',
          'ausenciaCliente': 'Ausencia del Cliente',
          'validacionHistorial': 'Validación del Historial',
          'tipificacionCriterio': 'Tipificación',
          'retencionTickets': 'Retención de Tickets',
          'tiempoRespuesta': 'Tiempo de Respuesta',
          'tiempoGestion': 'Tiempo de Gestión'
        }
      },
      'conocimiento': {
        title: 'Conocimiento Integral de la marca',
        criteria: {
          'serviciosPromociones': 'Servicios y Promociones',
          'informacionVeraz': 'Información Veraz',
          'parlamentosContingencia': 'Parlamentos de Contingencia',
          'honestidadTransparencia': 'Honestidad y Transparencia'
        }
      },
      'herramientas': {
        title: 'Uso estratégico de herramientas',
        criteria: {
          'rideryOffice': 'Ridery Office',
          'adminZendesk': 'Admin y Zendesk',
          'driveManuales': 'Drive y Manuales',
          'slack': 'Slack',
          'generacionReportes': 'Generación de Reportes',
          'cargaIncidencias': 'Carga de Incidencias'
        }
      }
    };

    let gestionHTML = '';
    Object.entries(gestionCategories).forEach(([categoryKey, category]) => {
      gestionHTML += `
        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.9rem; font-weight: 700; margin: 0 0 0.5rem 0; color: #f59e0b;">
            ${category.title}
          </h4>
          <div style="display: grid; gap: 0.35rem;">
      `;
      Object.entries(category.criteria).forEach(([key, label]) => {
        const checked = audit.evaluationData?.gestion?.[categoryKey]?.[key];
        const icon = checked ? '✓' : '✗';
        const color = checked ? '#38CEA6' : '#ef4444';
        const hasObservation = audit.criterionObservations && audit.criterionObservations[key];
        gestionHTML += `
          <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem; background: ${checked ? '#f0fdf4' : '#fef2f2'}; border-radius: 0.35rem;">
            <span style="font-size: 1rem; color: ${color}; font-weight: bold;">${icon}</span>
            <span style="flex: 1; font-size: 0.85rem; color: var(--text-primary);">${label}</span>
            ${hasObservation ? `
              <button class="btn-mini" onclick="App.showObservationModal('${label}', \`${hasObservation.replace(/`/g, '\\`')}\`); return false;" title="Ver observación" style="background: #f59e0b; color: white; border: none; font-size: 0.75rem; padding: 0.25rem 0.5rem; cursor: pointer;">
                <i class="fas fa-question-circle"></i>
              </button>
            ` : ''}
          </div>
        `;
      });
      gestionHTML += '</div></div>';
    });

    const content = `
      <div style="display: grid; gap: 1.5rem;">
        <!-- Basic Information -->
        <div style="background: #f0f9ff; padding: 1.5rem; border-radius: 0.75rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 1rem 0; color: var(--ridery-mint);">
            <i class="fas fa-info-circle"></i> Información Básica
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Agente</div>
              <div style="font-weight: 600;">${audit.agentName}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Equipo</div>
              <div style="font-weight: 600; color: ${team?.color || '#6b7280'};">${teamName}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Tipificación</div>
              <div style="font-weight: 600;">${audit.tipificacion || '-'}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">N° Ticket</div>
              <div style="font-weight: 600;">${audit.ticketId || '-'}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Fecha del Ticket</div>
              <div style="font-weight: 600;">${audit.ticketDate ? DataManager.formatDate(audit.ticketDate) : '-'}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Fecha de la Auditoría</div>
              <div style="font-weight: 600;">${DataManager.formatDate(audit.date)}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Calificación del Ticket</div>
              <div style="font-weight: 700; font-size: 1.2rem; color: #10b981;">${audit.score || 0}</div>
            </div>
          </div>
        </div>

        <!-- Resumen and Observations -->
        <div>
          <div style="margin-bottom: 1rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-primary);">
              <i class="fas fa-file-alt"></i> Resumen del Ticket
            </h4>
            <div style="background: white; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e5e7eb; white-space: pre-wrap; line-height: 1.6;">
              ${audit.ticketSummary || 'No hay resumen disponible'}
            </div>
          </div>
        </div>

        <!-- Evaluation Criteria -->
        <div style="background: #f0f9ff; padding: 1.5rem; border-radius: 0.75rem; border-left: 4px solid #38CEA6;">
          <h3 style="font-size: 1rem; font-weight: 700; margin: 0 0 1rem 0; color: #38CEA6;">
            <i class="fas fa-heart"></i> Pilar Empatía (${audit.empatiaScore || 0}%)
          </h3>
          ${empatiaHTML}
        </div>

        <div style="background: #fef3f2; padding: 1.5rem; border-radius: 0.75rem; border-left: 4px solid #f59e0b;">
          <h3 style="font-size: 1rem; font-weight: 700; margin: 0 0 1rem 0; color: #f59e0b;">
            <i class="fas fa-cogs"></i> Pilar Gestión (${audit.gestionScore || 0}%)
          </h3>
          ${gestionHTML}
        </div>

        <!-- Total Score Summary -->
        <div style="background: #f0fdf4; padding: 1.5rem; border-radius: 0.75rem; border: 2px solid #38CEA6; text-align: center;">
          <h3 style="font-size: 1rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-primary);">
            <i class="fas fa-chart-pie"></i> Puntuación Total
          </h3>
          <div style="font-size: 3rem; font-weight: 800; color: #10b981;">${audit.score || 0}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
            <div style="background: white; padding: 0.75rem; border-radius: 0.5rem;">
              <div style="font-size: 0.8rem; color: var(--text-muted);">Empatía</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: #38CEA6;">${audit.empatiaScore || 0}%</div>
            </div>
            <div style="background: white; padding: 0.75rem; border-radius: 0.5rem;">
              <div style="font-size: 0.8rem; color: var(--text-muted);">Gestión</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: #f59e0b;">${audit.gestionScore || 0}%</div>
            </div>
          </div>
        </div>

        <!-- Conversación de comentarios sobre la auditoría -->
        <div style="background: #f8fafc; padding: 1.25rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; display: grid; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem; color: #0f172a; font-weight: 800;">
            <span style="display: inline-flex; width: 36px; height: 36px; align-items: center; justify-content: center; border-radius: 999px; background: #dbeafe; color: #1d4ed8;">💬</span>
            <div>
              <div style="font-size: 1rem;">Conversación sobre la auditoría</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">Intercambia feedback entre editor y agente</div>
            </div>
          </div>
          <div id="commentsConversation" style="display: grid; gap: 0.5rem; max-height: 300px; overflow-y: auto;">
            ${this.renderAuditConversation(auditId)}
          </div>

          <!-- Comment input for both editor and agent -->
          <div style="background: white; border: 1px dashed #cbd5e1; padding: 0.85rem; border-radius: 0.75rem; display: grid; gap: 0.5rem;">
            <label for="agentComment" style="font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;">
              <i class="fas fa-pen"></i> ${isEditor ? 'Responder al agente' : 'Tu comentario'}
            </label>
            <textarea id="agentComment" rows="3" class="input-dark" style="width: 100%; resize: vertical;" placeholder="${isEditor ? 'Escribe tu respuesta al agente...' : 'Comparte tu comentario o aclaración...'}"></textarea>
            <button class="btn-accent" style="background: linear-gradient(135deg, ${isEditor ? '#8b5cf6, #6d28d9' : '#0ea5e9, #0369a1'}); color: white; border: none;" onclick="App.submitAuditComment('${auditId}')">
              <i class="fas fa-comment-dots"></i> ${isEditor ? 'Responder' : 'Comentar'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('auditViewContent').innerHTML = content;
    document.getElementById('auditViewModal').classList.remove('hidden');
  },

  renderAuditConversation(auditId) {
    const comments = DataManager.getAuditComments(auditId);
    const teams = DataManager.getAllTeams();
    
    const emailToName = (email) => {
      for (const team of Object.values(teams)) {
        const member = team.members?.find(m => m.email === email);
        if (member) return member.name;
      }
      return email;
    };
    
    if (comments.length === 0) {
      return '<div style="color: var(--text-muted); text-align: center; padding: 1rem;">Aún no hay comentarios. ¡Inicia la conversación!</div>';
    }
    
    return comments.map(msg => {
      const isEditorMsg = msg.senderRole === 'editor';
      const bgColor = isEditorMsg ? '#f3e8ff' : '#f0fdf4';
      const borderColor = isEditorMsg ? '#c4b5fd' : '#bbf7d0';
      const iconColor = isEditorMsg ? '#8b5cf6' : '#16a34a';
      const roleLabel = isEditorMsg ? 'Editor' : 'Agente';
      
      return `
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 0.75rem; padding: 0.75rem; ${isEditorMsg ? 'margin-left: 1rem;' : 'margin-right: 1rem;'}">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem; color: ${iconColor}; font-weight: 700; font-size: 0.85rem;">
              <i class="fas ${isEditorMsg ? 'fa-user-edit' : 'fa-user'}"></i>
              <span>${emailToName(msg.senderEmail)}</span>
              <span style="background: ${iconColor}; color: white; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.65rem;">${roleLabel}</span>
            </div>
            <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(msg.timestamp).toLocaleString()}</span>
          </div>
          <div style="color: var(--text-primary); line-height: 1.5; font-size: 0.9rem;">${msg.comment}</div>
        </div>
      `;
    }).join('');
  },

  submitAuditComment(auditId) {
    const commentBox = document.getElementById('agentComment');
    if (!commentBox) return;
    const comment = commentBox.value.trim();
    if (!comment) {
      alert('Escribe un comentario antes de enviarlo.');
      return;
    }

    const user = DataManager.getCurrentUser();
    const audit = DataManager.getAuditById(auditId);
    if (!audit) return;
    
    const isEditor = DataManager.isEditor();
    
    // Check if user can comment (editor or audit owner)
    const isAuditOwner = () => {
      if (!user) return false;
      if (audit.agentEmail && user.email === audit.agentEmail) return true;
      // Fallback: match by agent name using the member that has this email
      const teams = DataManager.getAllTeams();
      for (const team of Object.values(teams)) {
        const member = team.members?.find(m => m.email === user.email);
        if (member && member.name === audit.agentName) return true;
      }
      return false;
    };

    // Allow editors to reply and audit owners to comment
    if (!isEditor && !isAuditOwner()) {
      alert('Solo el agente dueño de la auditoría o el editor pueden comentar.');
      return;
    }

    // Save with role information
    DataManager.saveAuditComment(auditId, user.email, user.role, comment);
    
    // Clear the input
    commentBox.value = '';
    
    // Refresh the conversation display
    const conversationContainer = document.getElementById('commentsConversation');
    if (conversationContainer) {
      conversationContainer.innerHTML = this.renderAuditConversation(auditId);
    }
    
    this.loadRecentActivity();
  },

  closeViewModal() {
    document.getElementById('auditViewModal').classList.add('hidden');
  },

  // Weekly Metrics
  loadWeeklyMetrics() {
    const container = document.getElementById('weeklyMetricsContainer');
    const filterMonthMetrics = document.getElementById('filterMonthMetrics');
    const selectedMonth = filterMonthMetrics ? filterMonthMetrics.value : '';
    
    if (!selectedMonth) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-calendar-week" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
          <p>Seleccione un mes para ver las métricas semanales</p>
        </div>
      `;
      return;
    }
    
    const parsed = this.parseSelectedMonthValue(selectedMonth);
    const month = parsed.monthIndex;
    const currentYear = parsed.yearOverride ?? this.getEffectiveYearForMonth(month);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = monthNames[month];
    
    // Get all audits for the selected month
    const audits = DataManager.getAuditsByMonth(currentYear, month);
    
    // Get weeks for the month
    // Semanas se comparten entre equipos: usar configuración global del mes
    const weeks = DataManager.ensureWeekConfig(currentYear, month);

    if (!weeks.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-calendar-times" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
          <p>No hay semanas configuradas para ${monthName}. Configure semanas antes de cargar métricas.</p>
        </div>
      `;
      return;
    }
    
    // Calculate metrics for each week
    const weekMetrics = weeks.map(week => {
      const weekAudits = audits.filter(audit => {
        return audit.date >= week.startDate && audit.date <= week.endDate;
      });
      
      // Calculate agent metrics for this week
      const agentMetrics = {};
      weekAudits.forEach(audit => {
        if (!agentMetrics[audit.agentName]) {
          agentMetrics[audit.agentName] = {
            tickets: 0,
            totalScore: 0,
            empatiaTotal: 0,
            gestionTotal: 0,
            sumFirstResponse: 0,
            sumResolution: 0,
            connectionHours: 0
          };
        }
        agentMetrics[audit.agentName].tickets++;
        agentMetrics[audit.agentName].totalScore += parseFloat(audit.score || 0);
        agentMetrics[audit.agentName].empatiaTotal += parseFloat(audit.empatiaScore || 0);
        agentMetrics[audit.agentName].gestionTotal += parseFloat(audit.gestionScore || 0);
      });
      
      return {
        week: week,
        audits: weekAudits,
        agentMetrics: agentMetrics
      };
    });
    
    // Calculate monthly accumulated metrics
    const monthlyAgentMetrics = {};
    audits.forEach(audit => {
      if (!monthlyAgentMetrics[audit.agentName]) {
        monthlyAgentMetrics[audit.agentName] = {
          tickets: 0,
          totalScore: 0,
          empatiaTotal: 0,
          gestionTotal: 0
        };
      }
      monthlyAgentMetrics[audit.agentName].tickets++;
      monthlyAgentMetrics[audit.agentName].totalScore += parseFloat(audit.score || 0);
      monthlyAgentMetrics[audit.agentName].empatiaTotal += parseFloat(audit.empatiaScore || 0);
      monthlyAgentMetrics[audit.agentName].gestionTotal += parseFloat(audit.gestionScore || 0);
    });
    
    // Render the table
    this.renderWeeklyMetricsTable(monthName, weekMetrics, monthlyAgentMetrics);
  },

  renderWeeklyMetricsTable(monthName, weekMetrics, monthlyAgentMetrics) {
    const container = document.getElementById('weeklyMetricsContainer');
    const isEditor = DataManager.isEditor();
    const userTeam = DataManager.getUserTeam();
    const teams = DataManager.getAllTeams();
    
    // Get team filter selection (for editors)
    const filterTeamWeekly = document.getElementById('filterTeamWeekly');
    const selectedTeamFilter = filterTeamWeekly ? filterTeamWeekly.value : '';
    
    // Get manual metrics data
    const filterMonthMetrics = document.getElementById('filterMonthMetrics');
    const parsed = this.parseSelectedMonthValue(filterMonthMetrics.value);
    const month = parsed.monthIndex;
    const currentYear = parsed.yearOverride ?? this.getEffectiveYearForMonth(month);
    const manualData = DataManager.getWeeklyMetricsData(currentYear, month);
    const weeks = DataManager.getWeekConfig(currentYear, month);
    
    // Determine which team to show
    let teamToShow = userTeam; // For non-editors, use their assigned team
    if (isEditor && selectedTeamFilter) {
      teamToShow = selectedTeamFilter; // For editors, use selected filter
    }
    
    // If "Todos los Equipos" is selected (no team filter), render each team in its own section
    if (isEditor && !selectedTeamFilter && !userTeam) {
      let fullHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-primary);">
            <i class="fas fa-calendar-alt"></i> Mes de ${monthName} - Todos los Equipos
          </h3>
        </div>
      `;
      
      // Get teams that have members
      const teamsWithMembers = Object.values(teams).filter(team => 
        team.members && team.members.some(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad')
      );
      
      if (teamsWithMembers.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
            <p>No hay equipos con integrantes registrados</p>
          </div>
        `;
        return;
      }
      
      // Render each team in its own section
      teamsWithMembers.forEach(team => {
        const teamAgentsList = team.members
          .filter(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad')
          .map(m => m.name)
          .sort((a, b) => {
            const shiftA = this.getAgentShift(a, teams);
            const shiftB = this.getAgentShift(b, teams);
            return this.getShiftPriority(shiftA) - this.getShiftPriority(shiftB);
          });
        
        if (teamAgentsList.length > 0) {
          fullHTML += this.renderWeeklyMetricsTableForTeam(team.name, team.color, teamAgentsList, weeks, weekMetrics, manualData, monthlyAgentMetrics, teams, isEditor, currentYear, month);
        }
      });
      
      container.innerHTML = fullHTML;
      // Re-apply custom scrollbars for dynamically added tables
      this.initializeOverlayScrollbars();
      // Setup sticky agent names that follow horizontal scroll
      this.setupStickyAgentNames();
      return;
    }
    
    // Get all unique agents from audits AND manual data AND team members
    const allAgents = new Set();
    
    // Add agents from audits
    weekMetrics.forEach(wm => {
      Object.keys(wm.agentMetrics).forEach(agent => allAgents.add(agent));
    });
    Object.keys(monthlyAgentMetrics).forEach(agent => allAgents.add(agent));
    
    // Add agents from manual metrics
    Object.keys(manualData).forEach(agent => allAgents.add(agent));
    
    // Add all team members based on filter (exclude supervisors and analistas - they are not auditable)
    if (teamToShow) {
      // Show only specific team
      const team = teams[teamToShow];
      if (team && team.members) {
        team.members.forEach(member => {
          // Exclude supervisors and analistas from metrics
          if (member.role !== 'supervisor' && member.role !== 'analista') {
            allAgents.add(member.name);
          }
        });
      }
    }
    
    let agentsList = Array.from(allAgents).sort();
    
    // Filter agents by team and exclude supervisors/analistas
    if (teamToShow) {
      const team = teams[teamToShow];
      // Get only non-supervisor/non-analista members
      const teamMemberNames = team && team.members 
        ? team.members.filter(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad').map(m => m.name) 
        : [];
      agentsList = agentsList.filter(agent => teamMemberNames.includes(agent));
    }
    
    // Sort agents by shift priority
    agentsList.sort((a, b) => {
      // Get shift for each agent
      const shiftA = this.getAgentShift(a, teams);
      const shiftB = this.getAgentShift(b, teams);
      return this.getShiftPriority(shiftA) - this.getShiftPriority(shiftB);
    });
    
    if (agentsList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
          <p>No hay agentes registrados para ${monthName}. Por favor seleccione un equipo.</p>
        </div>
      `;
      return;
    }
    
    // Get team name for header
    const teamInfo = teamToShow ? teams[teamToShow] : null;
    const teamName = teamInfo ? teamInfo.name : 'Equipo';
    const teamColor = teamInfo ? teamInfo.color : '#38CEA6';
    
    // Build table HTML
    let tableHTML = `
      <div style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-primary);">
          <i class="fas fa-calendar-alt"></i> Mes de ${monthName} - ${teamName}
        </h3>
      </div>
      
      <div class="table-scroll">
        <table class="data-table weekly-metrics-table" style="font-size: 0.85rem;">
          <thead>
            <tr>
              <th rowspan="2" style="vertical-align: middle; min-width: 150px; position: sticky; left: 0; background: #f8fafc; z-index: 2;">Nombre del Agente</th>
              <th rowspan="2" style="vertical-align: middle; min-width: 100px; background: rgba(56, 206, 166, 0.1);">Turno</th>
    `;
    
    // Add week headers - USE ALL CONFIGURED WEEKS
    weeks.forEach((week, index) => {
      tableHTML += `
        <th colspan="${isEditor ? 10 : 9}" style="background: #f0f9ff; text-align: center; font-size: 0.8rem; padding: 0.5rem;">
          Semana ${index + 1}: ${week.startDate.split('-')[2]}/${week.startDate.split('-')[1]} al ${week.endDate.split('-')[2]}/${week.endDate.split('-')[1]}
        </th>
      `;
    });
    
    // Add accumulated month header
    tableHTML += `
      <th colspan="${isEditor ? 10 : 9}" style="background: #f0fdf4; text-align: center; font-weight: 700; font-size: 0.8rem; padding: 0.5rem;">
        ACUMULADO DEL MES
      </th>
    `;
    
    tableHTML += `</tr><tr>`;
    
    // Add metric subheaders for each week
    weeks.forEach(() => {
      tableHTML += `
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">Tickets</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">Tickets x Hora</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">Calif. Malos</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">Calif. Buena</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">T. Resp. (s)</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">T. Resol. (m)</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">T. Resp. (min)</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">% Calif.</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">% Calidad</th>
        ${isEditor ? '<th style="font-size: 0.7rem; background: #f8fafc;">Acción</th>' : ''}
      `;
    });
    
    // Add accumulated subheaders
    tableHTML += `
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">Tickets</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">Tickets x Hora</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">Calif. Malos</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">Calif. Buena</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">T. Resp. (s)</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">T. Resol. (m)</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">T. Resp. (min)</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">% Calif.</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">% Calidad</th>
      ${isEditor ? '<th style="font-size: 0.7rem; background: #f0fdf4;"></th>' : ''}
    `;
    
    tableHTML += `</tr></thead><tbody>`;
    
    // Add rows for each agent
    agentsList.forEach(agentName => {
      // Get agent shift
      const agentShift = this.getAgentShift(agentName, teams);
      const shiftBadge = this.getShiftBadge(agentShift);
      
      tableHTML += `<tr><td style="position: sticky; left: 0; background: white; z-index: 1;"><strong>${agentName}</strong></td><td>${shiftBadge}</td>`;
      
      // Calculate monthly totals
      let monthlyTotals = {
        tickets: 0,
        ticketsBad: 0,
        ticketsGood: 0,
        firstResponse: 0,
        resolutionTime: 0,
        ticketsPerHour: 0,
        quality: 0,
        qualityCount: 0,
        weekCount: 0
      };
      
      // Add data for EACH configured week
      weeks.forEach((week, weekIndex) => {
        // Find matching audit data for this week
        const weekMetric = weekMetrics.find(wm => 
          wm.week.startDate === week.startDate && wm.week.endDate === week.endDate
        );
        const audits = weekMetric && weekMetric.agentMetrics[agentName] ? weekMetric.agentMetrics[agentName] : null;
        const manual = manualData[agentName] && manualData[agentName][weekIndex] ? manualData[agentName][weekIndex] : {};
        
        // Quality percentage from audits (automatic)
        let qualityPercent = '-';
        if (audits && audits.tickets > 0) {
          const avgScore = Math.round(audits.totalScore / audits.tickets);
          qualityPercent = avgScore + '%';
          monthlyTotals.quality += avgScore;
          monthlyTotals.qualityCount++;
        }
        
        // Manual metrics
        const tickets = manual.tickets || 0;
        const ticketsBad = manual.ticketsBad || 0;
        const ticketsGood = manual.ticketsGood || 0;
        const firstResponse = manual.firstResponse || 0;
        const resolutionTime = manual.resolutionTime || 0;
        const ticketsPerHour = manual.ticketsPerHour || 0;
        const firstResponseMinutes = firstResponse ? (firstResponse / 60) : 0;
        
        // Calculate % Calif automatically: (ticketsBad + ticketsGood) / tickets * 100
        let percentCalif = '-';
        if (tickets > 0) {
          const ratedTickets = ticketsBad + ticketsGood;
          percentCalif = ((ratedTickets / tickets) * 100).toFixed(1) + '%';
        }
        
        // Accumulate for monthly totals (ticketsPerHour stays visual-only for now)
        if (tickets > 0 || ticketsBad > 0 || ticketsGood > 0 || firstResponse > 0 || resolutionTime > 0) {
          monthlyTotals.tickets += tickets;
          monthlyTotals.ticketsBad += ticketsBad;
          monthlyTotals.ticketsGood += ticketsGood;
          monthlyTotals.firstResponse += firstResponse;
          monthlyTotals.resolutionTime += resolutionTime;
          monthlyTotals.weekCount++;
        }
        
        tableHTML += `
          <td style="text-align: center;">${tickets || '-'}</td>
          <td style="text-align: center; font-weight: 600; color: #8b5cf6;">-</td>
          <td style="text-align: center;">${ticketsBad || '-'}</td>
          <td style="text-align: center;">${ticketsGood || '-'}</td>
          <td style="text-align: center;">${firstResponse || '-'}</td>
          <td style="text-align: center;">${resolutionTime || '-'}</td>
          <td style="text-align: center;">${firstResponseMinutes ? firstResponseMinutes.toFixed(1) : '-'}</td>
          <td style="text-align: center; font-weight: 600; color: #0ea5e9;">${percentCalif}</td>
          <td style="text-align: center; color: #38CEA6; font-weight: 600;">${qualityPercent}</td>
          ${isEditor ? `<td style="text-align: center;"><button class="btn-mini" onclick="App.openManualMetricsModal('${agentName}', ${weekIndex}, ${currentYear}, ${month})" title="Editar métricas"><i class="fas fa-edit"></i></button></td>` : ''}
        `;
      });
      
      // Add accumulated data
      const avgFirstResponse = monthlyTotals.weekCount > 0 ? Math.round(monthlyTotals.firstResponse / monthlyTotals.weekCount) : 0;
      const avgResolutionTime = monthlyTotals.weekCount > 0 ? Math.round(monthlyTotals.resolutionTime / monthlyTotals.weekCount) : 0;
      const avgFirstResponseMinutes = avgFirstResponse ? (avgFirstResponse / 60).toFixed(1) : '-';
      const avgQuality = monthlyTotals.qualityCount > 0 ? Math.round(monthlyTotals.quality / monthlyTotals.qualityCount) : 0;
      const avgTicketsPerHour = '-';
      
      // Calculate total % Calif: (total rated / total tickets) * 100
      const totalRated = monthlyTotals.ticketsBad + monthlyTotals.ticketsGood;
      const totalPercentCalif = monthlyTotals.tickets > 0 ? ((totalRated / monthlyTotals.tickets) * 100).toFixed(1) : 0;
      
      tableHTML += `
        <td style="text-align: center; background: #f0fdf4; font-weight: 700;">${monthlyTotals.tickets || '-'}</td>
        <td style="text-align: center; background: #f0fdf4; font-weight: 700; color: #8b5cf6;">-</td>
        <td style="text-align: center; background: #f0fdf4; font-weight: 700;">${monthlyTotals.ticketsBad || '-'}</td>
        <td style="text-align: center; background: #f0fdf4; font-weight: 700;">${monthlyTotals.ticketsGood || '-'}</td>
        <td style="text-align: center; background: #f0fdf4; font-weight: 700;">${avgFirstResponse || '-'}</td>
        <td style="text-align: center; background: #f0fdf4; font-weight: 700;">${avgResolutionTime || '-'}</td>
        <td style="text-align: center; background: #f0fdf4; font-weight: 700;">${avgFirstResponseMinutes}</td>
        <td style="text-align: center; background: #f0fdf4; font-weight: 700; color: #0ea5e9;">${totalPercentCalif}%</td>
        <td style="text-align: center; background: #f0fdf4; color: #38CEA6; font-weight: 700;">${avgQuality || '-'}%</td>
        ${isEditor ? '<td style="background: #f0fdf4;"></td>' : ''}
      `;
      
      tableHTML += `</tr>`;
    });
    
    // Calculate and add PROMEDIO (average) row
    if (agentsList.length > 0) {
      const avgRow = { tickets: [], ticketsPerHour: [], ticketsBad: [], ticketsGood: [], firstResponse: [], resolutionTime: [], firstResponseMinutes: [], quality: [], qualityCount: [], agentCount: [] };
      const monthlyAvg = { tickets: 0, ticketsPerHour: 0, ticketsBad: 0, ticketsGood: 0, firstResponse: 0, resolutionTime: 0, quality: 0, qualityCount: 0, agentCount: 0, weekCount: 0 };
      
      // Sum up all agent metrics for each week and count agents with data
      agentsList.forEach(agentName => {
        weeks.forEach((week, weekIndex) => {
          const weekData = manualData[agentName] && manualData[agentName][weekIndex];
          const weekMetric = weekMetrics.find(wm => 
            wm.week.startDate === week.startDate && wm.week.endDate === week.endDate
          );
          const audits = weekMetric && weekMetric.agentMetrics[agentName] ? weekMetric.agentMetrics[agentName] : null;
          
          if (weekData && (weekData.tickets > 0 || weekData.firstResponse > 0 || weekData.resolutionTime > 0)) {
            // Initialize arrays if not exists
            avgRow.tickets[weekIndex] = (avgRow.tickets[weekIndex] || 0) + (weekData.tickets || 0);
            // ticketsPerHour visual-only for ahora (se muestra '-').
            avgRow.ticketsBad[weekIndex] = (avgRow.ticketsBad[weekIndex] || 0) + (weekData.ticketsBad || 0);
            avgRow.ticketsGood[weekIndex] = (avgRow.ticketsGood[weekIndex] || 0) + (weekData.ticketsGood || 0);
            avgRow.firstResponse[weekIndex] = (avgRow.firstResponse[weekIndex] || 0) + (weekData.firstResponse || 0);
            avgRow.resolutionTime[weekIndex] = (avgRow.resolutionTime[weekIndex] || 0) + (weekData.resolutionTime || 0);
            avgRow.firstResponseMinutes[weekIndex] = (avgRow.firstResponseMinutes[weekIndex] || 0) + ((weekData.firstResponse || 0) / 60);
            // Count agents with data for this week
            avgRow.agentCount[weekIndex] = (avgRow.agentCount[weekIndex] || 0) + 1;
          }
          
          // Add quality from audits if available
          if (audits && audits.tickets > 0) {
            const avgScore = Math.round(audits.totalScore / audits.tickets);
            avgRow.quality[weekIndex] = (avgRow.quality[weekIndex] || 0) + avgScore;
            avgRow.qualityCount[weekIndex] = (avgRow.qualityCount[weekIndex] || 0) + 1;
          }
        });
        
        // Sum monthly totals
        const monthlyTotals = { tickets: 0, ticketsBad: 0, ticketsGood: 0, firstResponse: 0, resolutionTime: 0, ticketsPerHour: 0, quality: 0, qualityCount: 0, weekCount: 0 };
        weeks.forEach((week, weekIndex) => {
          const weekData = manualData[agentName] && manualData[agentName][weekIndex];
          const weekMetric = weekMetrics.find(wm => 
            wm.week.startDate === week.startDate && wm.week.endDate === week.endDate
          );
          const audits = weekMetric && weekMetric.agentMetrics[agentName] ? weekMetric.agentMetrics[agentName] : null;
          
          if (weekData && (weekData.tickets > 0 || weekData.firstResponse > 0 || weekData.resolutionTime > 0)) {
            monthlyTotals.tickets += weekData.tickets || 0;
            monthlyTotals.ticketsBad += weekData.ticketsBad || 0;
            monthlyTotals.ticketsGood += weekData.ticketsGood || 0;
            monthlyTotals.firstResponse += weekData.firstResponse || 0;
            monthlyTotals.resolutionTime += weekData.resolutionTime || 0;
            monthlyTotals.weekCount++;
          }
          
          // Add quality from audits
          if (audits && audits.tickets > 0) {
            const avgScore = Math.round(audits.totalScore / audits.tickets);
            monthlyTotals.quality += avgScore;
            monthlyTotals.qualityCount++;
          }
        });
        
        if (monthlyTotals.weekCount > 0) {
          monthlyAvg.tickets += monthlyTotals.tickets;
          monthlyAvg.ticketsBad += monthlyTotals.ticketsBad;
          monthlyAvg.ticketsGood += monthlyTotals.ticketsGood;
          monthlyAvg.firstResponse += monthlyTotals.firstResponse;
          monthlyAvg.resolutionTime += monthlyTotals.resolutionTime;
          monthlyAvg.ticketsPerHour += monthlyTotals.ticketsPerHour;
          monthlyAvg.weekCount += monthlyTotals.weekCount;
          monthlyAvg.agentCount++;
        }
        
        if (monthlyTotals.qualityCount > 0) {
          monthlyAvg.quality += monthlyTotals.quality;
          monthlyAvg.qualityCount += monthlyTotals.qualityCount;
        }
      });
      
      // Build PROMEDIO row
      tableHTML += `
        <tr style="background: rgba(56, 206, 166, 0.15); font-weight: 600; border-top: 2px solid #38CEA6;">
          <td colspan="2" style="text-align: center;">📊 PROMEDIO</td>
      `;
      
      // Calculate totals/averages for each week
      weeks.forEach((week, weekIndex) => {
        const agentCountForWeek = avgRow.agentCount[weekIndex] || 0;
        
        // TOTALS (sums) for counts
        const totalTickets = avgRow.tickets[weekIndex] || 0;
        const totalBad = avgRow.ticketsBad[weekIndex] || 0;
        const totalGood = avgRow.ticketsGood[weekIndex] || 0;
        
        // AVERAGES for rates and times (divide by agents with data, not all agents)
        const avgTicketsPerHour = agentCountForWeek > 0 ? (avgRow.ticketsPerHour[weekIndex] || 0) / agentCountForWeek : 0;
        const avgFirstResp = agentCountForWeek > 0 ? (avgRow.firstResponse[weekIndex] || 0) / agentCountForWeek : 0;
        const avgResol = agentCountForWeek > 0 ? (avgRow.resolutionTime[weekIndex] || 0) / agentCountForWeek : 0;
        const avgFirstRespMin = avgFirstResp > 0 ? (avgFirstResp / 60) : 0;
        
        // Calculated percentage from totals
        const totalCalifPct = totalTickets > 0 ? ((totalBad + totalGood) / totalTickets * 100) : 0;
        
        // Calculate average quality from audits for this week
        const avgQuality = avgRow.qualityCount[weekIndex] > 0 ? (avgRow.quality[weekIndex] / avgRow.qualityCount[weekIndex]) : 0;
        
        tableHTML += `
          <td style="text-align: center;">${totalTickets > 0 ? totalTickets.toFixed(0) : '-'}</td>
          <td style="text-align: center; color: #8b5cf6;">${avgTicketsPerHour > 0 ? avgTicketsPerHour.toFixed(1) : '-'}</td>
          <td style="text-align: center;">${totalBad > 0 ? totalBad.toFixed(0) : '-'}</td>
          <td style="text-align: center;">${totalGood > 0 ? totalGood.toFixed(0) : '-'}</td>
          <td style="text-align: center;">${avgFirstResp > 0 ? avgFirstResp.toFixed(1) : '-'}</td>
          <td style="text-align: center;">${avgResol > 0 ? avgResol.toFixed(1) : '-'}</td>
          <td style="text-align: center; color: #0ea5e9;">${avgFirstRespMin > 0 ? avgFirstRespMin.toFixed(1) : '-'}</td>
          <td style="text-align: center; color: #0ea5e9;">${totalCalifPct > 0 ? totalCalifPct.toFixed(1) + '%' : '-'}</td>
          <td style="text-align: center; color: #38CEA6;">${avgQuality > 0 ? avgQuality.toFixed(1) + '%' : '-'}</td>
          ${isEditor ? '<td></td>' : ''}
        `;
      });
      
      // Monthly totals and averages
      const monthlyTotalTickets = monthlyAvg.tickets;
      const monthlyTotalBad = monthlyAvg.ticketsBad;
      const monthlyTotalGood = monthlyAvg.ticketsGood;
      const monthlyAvgTicketsPerHour = monthlyAvg.weekCount > 0 ? monthlyAvg.ticketsPerHour / monthlyAvg.weekCount : 0;
      const monthlyAvgFirstResp = monthlyAvg.weekCount > 0 ? monthlyAvg.firstResponse / monthlyAvg.weekCount : 0;
      const monthlyAvgResol = monthlyAvg.weekCount > 0 ? monthlyAvg.resolutionTime / monthlyAvg.weekCount : 0;
      const monthlyAvgFirstRespMin = monthlyAvgFirstResp > 0 ? (monthlyAvgFirstResp / 60) : 0;
      const monthlyTotalCalifPct = monthlyTotalTickets > 0 ? ((monthlyTotalBad + monthlyTotalGood) / monthlyTotalTickets * 100) : 0;
      const monthlyAvgQuality = monthlyAvg.qualityCount > 0 ? (monthlyAvg.quality / monthlyAvg.qualityCount) : 0;
      
      tableHTML += `
        <td style="text-align: center; background: #f0fdf4;">${monthlyTotalTickets > 0 ? monthlyTotalTickets.toFixed(0) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4; color: #8b5cf6;">${monthlyAvgTicketsPerHour > 0 ? monthlyAvgTicketsPerHour.toFixed(1) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyTotalBad > 0 ? monthlyTotalBad.toFixed(0) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyTotalGood > 0 ? monthlyTotalGood.toFixed(0) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyAvgFirstResp > 0 ? monthlyAvgFirstResp.toFixed(1) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyAvgResol > 0 ? monthlyAvgResol.toFixed(1) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4; color: #0ea5e9;">${monthlyAvgFirstRespMin > 0 ? monthlyAvgFirstRespMin.toFixed(1) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4; color: #0ea5e9;">${monthlyTotalCalifPct > 0 ? monthlyTotalCalifPct.toFixed(1) + '%' : '-'}</td>
        <td style="text-align: center; background: #f0fdf4; color: #38CEA6;">${monthlyAvgQuality > 0 ? monthlyAvgQuality.toFixed(1) + '%' : '-'}</td>
        ${isEditor ? '<td style="background: #f0fdf4;"></td>' : ''}
      </tr>
      `;
    }
    
    tableHTML += `</tbody></table></div>`;
    
    container.innerHTML = tableHTML;
    // Re-apply custom scrollbars for dynamically added tables
    this.initializeOverlayScrollbars();
    // Setup sticky agent names that follow horizontal scroll
    this.setupStickyAgentNames();
  },

  // Helper function to render weekly metrics table for a single team
  renderWeeklyMetricsTableForTeam(teamName, teamColor, agentsList, weeks, weekMetrics, manualData, monthlyAgentMetrics, teams, isEditor, currentYear, month) {
    if (agentsList.length === 0) return '';
    
    let tableHTML = `
      <div style="margin-bottom: 2rem; border: 2px solid ${teamColor}; border-radius: 0.75rem; overflow: visible;">
        <div style="background: ${teamColor}; color: white; padding: 0.75rem 1rem;">
          <h4 style="margin: 0; font-size: 1rem; font-weight: 700;">
            <i class="fas fa-users"></i> ${teamName}
          </h4>
        </div>
        
        <div class="table-scroll">
          <table class="data-table weekly-metrics-table" style="font-size: 0.85rem; margin: 0;">
            <thead>
              <tr>
                <th rowspan="2" style="vertical-align: middle; min-width: 150px; position: sticky; left: 0; background: #f8fafc; z-index: 2;">Nombre del Agente</th>
                <th rowspan="2" style="vertical-align: middle; min-width: 100px; background: rgba(56, 206, 166, 0.1);">Turno</th>
    `;
    
    // Add week headers
    weeks.forEach((week, index) => {
      tableHTML += `
        <th colspan="${isEditor ? 10 : 9}" style="background: #f0f9ff; text-align: center; font-size: 0.8rem; padding: 0.5rem;">
          Semana ${index + 1}: ${week.startDate.split('-')[2]}/${week.startDate.split('-')[1]} al ${week.endDate.split('-')[2]}/${week.endDate.split('-')[1]}
        </th>
      `;
    });
    
    // Add accumulated month header
    tableHTML += `
      <th colspan="${isEditor ? 10 : 9}" style="background: #f0fdf4; text-align: center; font-weight: 700; font-size: 0.8rem; padding: 0.5rem;">
        ACUMULADO DEL MES
      </th>
    `;
    
    tableHTML += `</tr><tr>`;
    
    // Add metric subheaders for each week
    weeks.forEach(() => {
      tableHTML += `
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">Tickets</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">Tickets x Hora</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">Calif. Malos</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">Calif. Buena</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">T. Resp. (s)</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">T. Resol. (m)</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">T. Resp. (min)</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">% Calif.</th>
        <th style="font-size: 0.7rem; background: #f8fafc; white-space: nowrap;">% Calidad</th>
        ${isEditor ? '<th style="font-size: 0.7rem; background: #f8fafc;">Acción</th>' : ''}
      `;
    });
    
    // Add accumulated subheaders
    tableHTML += `
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">Tickets</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">Tickets x Hora</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">Calif. Malos</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">Calif. Buena</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">T. Resp. (s)</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">T. Resol. (m)</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">T. Resp. (min)</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">% Calif.</th>
      <th style="font-size: 0.7rem; background: #f0fdf4; white-space: nowrap;">% Calidad</th>
      ${isEditor ? '<th style="font-size: 0.7rem; background: #f0fdf4;"></th>' : ''}
    `;
    
    tableHTML += `</tr></thead><tbody>`;
    
    // Add rows for each agent
    agentsList.forEach(agentName => {
      // Get agent shift
      const agentShift = this.getAgentShift(agentName, teams);
      const shiftBadge = this.getShiftBadge(agentShift);
      
      tableHTML += `<tr><td style="position: sticky; left: 0; background: white; z-index: 1;"><strong>${agentName}</strong></td><td>${shiftBadge}</td>`;
      
      // Calculate monthly totals
      let monthlyTotals = {
        tickets: 0,
        ticketsBad: 0,
        ticketsGood: 0,
        firstResponse: 0,
        resolutionTime: 0,
        ticketsPerHour: 0,
        ticketsPerHourCount: 0,
        quality: 0,
        qualityCount: 0,
        weekCount: 0
      };
      
      // Add cells for each week
      weeks.forEach((week, weekIndex) => {
        const weekData = manualData[agentName] && manualData[agentName][weekIndex] ? manualData[agentName][weekIndex] : {};
        const weekMetric = weekMetrics.find(wm => 
          wm.week.startDate === week.startDate && wm.week.endDate === week.endDate
        );
        const audits = weekMetric && weekMetric.agentMetrics[agentName] ? weekMetric.agentMetrics[agentName] : null;
        
        // Get values from manual data
        const tickets = weekData.tickets || 0;
        const ticketsPerHour = weekData.ticketsPerHour || 0;
        const ticketsBad = weekData.ticketsBad || 0;
        const ticketsGood = weekData.ticketsGood || 0;
        const firstResponse = weekData.firstResponse || 0;
        const resolutionTime = weekData.resolutionTime || 0;
        
        // Calculate percentages
        let califPct = 0;
        if (tickets > 0) {
          califPct = ((ticketsBad + ticketsGood) / tickets * 100).toFixed(1);
        }
        
        // Get quality from audits
        let qualityPct = 0;
        if (audits && audits.tickets > 0) {
          qualityPct = Math.round(audits.totalScore / audits.tickets);
        }
        
        // Add to monthly totals
        if (tickets > 0 || firstResponse > 0 || resolutionTime > 0) {
          monthlyTotals.tickets += tickets;
          monthlyTotals.ticketsBad += ticketsBad;
          monthlyTotals.ticketsGood += ticketsGood;
          monthlyTotals.firstResponse += firstResponse;
          monthlyTotals.resolutionTime += resolutionTime;
          monthlyTotals.weekCount++;
          if (ticketsPerHour > 0) {
            monthlyTotals.ticketsPerHour += ticketsPerHour;
            monthlyTotals.ticketsPerHourCount++;
          }
        }
        
        if (qualityPct > 0) {
          monthlyTotals.quality += qualityPct;
          monthlyTotals.qualityCount++;
        }
        
        // Calculate T. Resp. (min) from T. Resp. (s)
        const firstResponseMin = firstResponse > 0 ? (firstResponse / 60).toFixed(1) : '-';
        
        tableHTML += `
          <td style="text-align: center;">${tickets || '-'}</td>
          <td style="text-align: center; color: #8b5cf6;">${ticketsPerHour > 0 ? ticketsPerHour.toFixed(1) : '-'}</td>
          <td style="text-align: center;">${ticketsBad || '-'}</td>
          <td style="text-align: center;">${ticketsGood || '-'}</td>
          <td style="text-align: center;">${firstResponse || '-'}</td>
          <td style="text-align: center;">${resolutionTime || '-'}</td>
          <td style="text-align: center; color: #0ea5e9;">${firstResponseMin}</td>
          <td style="text-align: center;">${califPct > 0 ? califPct + '%' : '-'}</td>
          <td style="text-align: center; color: #38CEA6;">${qualityPct > 0 ? qualityPct + '%' : '-'}</td>
          ${isEditor ? `<td style="text-align: center;"><button class="btn-mini" onclick="App.openManualMetricsModal('${agentName}', ${weekIndex}, ${currentYear}, ${month})"><i class="fas fa-edit"></i></button></td>` : ''}
        `;
      });
      
      // Add monthly totals/averages
      const avgFirstResponse = monthlyTotals.weekCount > 0 ? Math.round(monthlyTotals.firstResponse / monthlyTotals.weekCount) : 0;
      const avgResolution = monthlyTotals.weekCount > 0 ? Math.round(monthlyTotals.resolutionTime / monthlyTotals.weekCount) : 0;
      const avgTicketsPerHour = monthlyTotals.ticketsPerHourCount > 0 ? (monthlyTotals.ticketsPerHour / monthlyTotals.ticketsPerHourCount).toFixed(1) : '-';
      const avgQuality = monthlyTotals.qualityCount > 0 ? Math.round(monthlyTotals.quality / monthlyTotals.qualityCount) : 0;
      
      let monthlyCalifPct = 0;
      if (monthlyTotals.tickets > 0) {
        monthlyCalifPct = ((monthlyTotals.ticketsBad + monthlyTotals.ticketsGood) / monthlyTotals.tickets * 100).toFixed(1);
      }
      
      const avgFirstResponseMin = avgFirstResponse > 0 ? (avgFirstResponse / 60).toFixed(1) : '-';
      
      tableHTML += `
        <td style="text-align: center; background: #f0fdf4; font-weight: 600;">${monthlyTotals.tickets || '-'}</td>
        <td style="text-align: center; background: #f0fdf4; color: #8b5cf6; font-weight: 600;">${avgTicketsPerHour}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyTotals.ticketsBad || '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyTotals.ticketsGood || '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${avgFirstResponse || '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${avgResolution || '-'}</td>
        <td style="text-align: center; background: #f0fdf4; color: #0ea5e9;">${avgFirstResponseMin}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyCalifPct > 0 ? monthlyCalifPct + '%' : '-'}</td>
        <td style="text-align: center; background: #f0fdf4; color: #38CEA6; font-weight: 600;">${avgQuality > 0 ? avgQuality + '%' : '-'}</td>
        ${isEditor ? '<td style="background: #f0fdf4;"></td>' : ''}
      </tr>`;
    });

    // Fila PROMEDIO para el equipo (cuando se ve "Todos los equipos")
    if (agentsList.length > 0) {
      const avgRow = { tickets: [], ticketsPerHour: [], ticketsBad: [], ticketsGood: [], firstResponse: [], resolutionTime: [], agentCount: [], quality: [], qualityCount: [] };
      const monthlyAvg = { tickets: 0, ticketsBad: 0, ticketsGood: 0, firstResponse: 0, resolutionTime: 0, weekCount: 0, ticketsPerHour: 0, ticketsPerHourCount: 0, quality: 0, qualityCount: 0, agentCount: 0 };

      agentsList.forEach(agentName => {
        weeks.forEach((week, weekIndex) => {
          const weekData = manualData[agentName] && manualData[agentName][weekIndex];
          const weekMetric = weekMetrics.find(wm => wm.week.startDate === week.startDate && wm.week.endDate === week.endDate);
          const audits = weekMetric && weekMetric.agentMetrics[agentName] ? weekMetric.agentMetrics[agentName] : null;

          if (weekData && (weekData.tickets > 0 || weekData.firstResponse > 0 || weekData.resolutionTime > 0)) {
            avgRow.tickets[weekIndex] = (avgRow.tickets[weekIndex] || 0) + (weekData.tickets || 0);
            avgRow.ticketsBad[weekIndex] = (avgRow.ticketsBad[weekIndex] || 0) + (weekData.ticketsBad || 0);
            avgRow.ticketsGood[weekIndex] = (avgRow.ticketsGood[weekIndex] || 0) + (weekData.ticketsGood || 0);
            avgRow.firstResponse[weekIndex] = (avgRow.firstResponse[weekIndex] || 0) + (weekData.firstResponse || 0);
            avgRow.resolutionTime[weekIndex] = (avgRow.resolutionTime[weekIndex] || 0) + (weekData.resolutionTime || 0);
            if (weekData.ticketsPerHour > 0) {
              avgRow.ticketsPerHour[weekIndex] = (avgRow.ticketsPerHour[weekIndex] || 0) + (weekData.ticketsPerHour || 0);
            }
            avgRow.agentCount[weekIndex] = (avgRow.agentCount[weekIndex] || 0) + 1;
          }

          if (audits && audits.tickets > 0) {
            const avgScore = Math.round(audits.totalScore / audits.tickets);
            avgRow.quality[weekIndex] = (avgRow.quality[weekIndex] || 0) + avgScore;
            avgRow.qualityCount[weekIndex] = (avgRow.qualityCount[weekIndex] || 0) + 1;
          }
        });

        // Monthly aggregation for this agent
        let agentWeekCount = 0;
        let agentTickets = 0;
        let agentBad = 0;
        let agentGood = 0;
        let agentFirstResp = 0;
        let agentResol = 0;
        let agentTphSum = 0;
        let agentTphCount = 0;
        let agentQualitySum = 0;
        let agentQualityCount = 0;

        weeks.forEach((week, weekIndex) => {
          const weekData = manualData[agentName] && manualData[agentName][weekIndex];
          const weekMetric = weekMetrics.find(wm => wm.week.startDate === week.startDate && wm.week.endDate === week.endDate);
          const audits = weekMetric && weekMetric.agentMetrics[agentName] ? weekMetric.agentMetrics[agentName] : null;

          if (weekData && (weekData.tickets > 0 || weekData.firstResponse > 0 || weekData.resolutionTime > 0)) {
            agentTickets += weekData.tickets || 0;
            agentBad += weekData.ticketsBad || 0;
            agentGood += weekData.ticketsGood || 0;
            agentFirstResp += weekData.firstResponse || 0;
            agentResol += weekData.resolutionTime || 0;
            agentWeekCount++;
            if (weekData.ticketsPerHour > 0) {
              agentTphSum += weekData.ticketsPerHour;
              agentTphCount++;
            }
          }
          if (audits && audits.tickets > 0) {
            agentQualitySum += Math.round(audits.totalScore / audits.tickets);
            agentQualityCount++;
          }
        });

        if (agentWeekCount > 0) {
          monthlyAvg.tickets += agentTickets;
          monthlyAvg.ticketsBad += agentBad;
          monthlyAvg.ticketsGood += agentGood;
          monthlyAvg.firstResponse += agentFirstResp;
          monthlyAvg.resolutionTime += agentResol;
          monthlyAvg.weekCount += agentWeekCount;
          if (agentTphCount > 0) {
            monthlyAvg.ticketsPerHour += agentTphSum;
            monthlyAvg.ticketsPerHourCount += agentTphCount;
          }
          monthlyAvg.agentCount++;
        }
        if (agentQualityCount > 0) {
          monthlyAvg.quality += agentQualitySum;
          monthlyAvg.qualityCount += agentQualityCount;
        }
      });

      tableHTML += `
        <tr style="background: rgba(56, 206, 166, 0.15); font-weight: 700; border-top: 2px solid #38CEA6;">
          <td colspan="2" style="text-align: center;">📊 PROMEDIO</td>
      `;

      weeks.forEach((week, weekIndex) => {
        const agentCountForWeek = avgRow.agentCount[weekIndex] || 0;
        const totalTickets = avgRow.tickets[weekIndex] || 0;
        const totalBad = avgRow.ticketsBad[weekIndex] || 0;
        const totalGood = avgRow.ticketsGood[weekIndex] || 0;
        const avgTph = agentCountForWeek > 0 ? (avgRow.ticketsPerHour[weekIndex] || 0) / agentCountForWeek : 0;
        const avgFirstResp = agentCountForWeek > 0 ? (avgRow.firstResponse[weekIndex] || 0) / agentCountForWeek : 0;
        const avgResol = agentCountForWeek > 0 ? (avgRow.resolutionTime[weekIndex] || 0) / agentCountForWeek : 0;
        const avgFirstRespMin = avgFirstResp > 0 ? (avgFirstResp / 60) : 0;
        const totalCalifPct = totalTickets > 0 ? ((totalBad + totalGood) / totalTickets * 100) : 0;
        const avgQuality = (avgRow.qualityCount[weekIndex] || 0) > 0 ? (avgRow.quality[weekIndex] / avgRow.qualityCount[weekIndex]) : 0;

        tableHTML += `
          <td style="text-align: center;">${totalTickets > 0 ? totalTickets.toFixed(0) : '-'}</td>
          <td style="text-align: center; color: #8b5cf6;">${avgTph > 0 ? avgTph.toFixed(1) : '-'}</td>
          <td style="text-align: center;">${totalBad > 0 ? totalBad.toFixed(0) : '-'}</td>
          <td style="text-align: center;">${totalGood > 0 ? totalGood.toFixed(0) : '-'}</td>
          <td style="text-align: center;">${avgFirstResp > 0 ? avgFirstResp.toFixed(1) : '-'}</td>
          <td style="text-align: center;">${avgResol > 0 ? avgResol.toFixed(1) : '-'}</td>
          <td style="text-align: center; color: #0ea5e9;">${avgFirstRespMin > 0 ? avgFirstRespMin.toFixed(1) : '-'}</td>
          <td style="text-align: center;">${totalCalifPct > 0 ? totalCalifPct.toFixed(1) + '%' : '-'}</td>
          <td style="text-align: center; color: #38CEA6;">${avgQuality > 0 ? avgQuality.toFixed(1) + '%' : '-'}</td>
          ${isEditor ? '<td></td>' : ''}
        `;
      });

      const monthlyTotalTickets = monthlyAvg.tickets;
      const monthlyTotalBad = monthlyAvg.ticketsBad;
      const monthlyTotalGood = monthlyAvg.ticketsGood;
      const monthlyAvgTph = monthlyAvg.ticketsPerHourCount > 0 ? (monthlyAvg.ticketsPerHour / monthlyAvg.ticketsPerHourCount) : 0;
      const monthlyAvgFirstResp = monthlyAvg.weekCount > 0 ? (monthlyAvg.firstResponse / monthlyAvg.weekCount) : 0;
      const monthlyAvgResol = monthlyAvg.weekCount > 0 ? (monthlyAvg.resolutionTime / monthlyAvg.weekCount) : 0;
      const monthlyAvgFirstRespMin = monthlyAvgFirstResp > 0 ? (monthlyAvgFirstResp / 60) : 0;
      const monthlyTotalCalifPct = monthlyTotalTickets > 0 ? ((monthlyTotalBad + monthlyTotalGood) / monthlyTotalTickets * 100) : 0;
      const monthlyAvgQuality = monthlyAvg.qualityCount > 0 ? (monthlyAvg.quality / monthlyAvg.qualityCount) : 0;

      tableHTML += `
        <td style="text-align: center; background: #f0fdf4;">${monthlyTotalTickets > 0 ? monthlyTotalTickets.toFixed(0) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4; color: #8b5cf6;">${monthlyAvgTph > 0 ? monthlyAvgTph.toFixed(1) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyTotalBad > 0 ? monthlyTotalBad.toFixed(0) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyTotalGood > 0 ? monthlyTotalGood.toFixed(0) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyAvgFirstResp > 0 ? monthlyAvgFirstResp.toFixed(1) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyAvgResol > 0 ? monthlyAvgResol.toFixed(1) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4; color: #0ea5e9;">${monthlyAvgFirstRespMin > 0 ? monthlyAvgFirstRespMin.toFixed(1) : '-'}</td>
        <td style="text-align: center; background: #f0fdf4;">${monthlyTotalCalifPct > 0 ? monthlyTotalCalifPct.toFixed(1) + '%' : '-'}</td>
        <td style="text-align: center; background: #f0fdf4; color: #38CEA6;">${monthlyAvgQuality > 0 ? monthlyAvgQuality.toFixed(1) + '%' : '-'}</td>
        ${isEditor ? '<td style="background: #f0fdf4;"></td>' : ''}
      </tr>
      `;
    }
    
    tableHTML += `</tbody></table></div></div>`;
    
    return tableHTML;
  },

  renderWeeklyChart(metrics, weekData = null) {
    // This function is no longer used with the new weekly metrics view
    // Kept for compatibility
  },

  renderWeeklyAgentsTable(metrics) {
    // This function is no longer used with the new weekly metrics view
    // Kept for compatibility
  },

  // Monthly Metrics
  loadMonthlyMetrics() {
    const filterMonthlyMetrics = document.getElementById('filterMonthlyMetrics');
    const selectedMonth = filterMonthlyMetrics ? filterMonthlyMetrics.value : '';
    
    if (!selectedMonth) {
      const container = document.getElementById('monthlyMetricsContent');
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-chart-bar" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
          <p>Seleccione un mes para ver las métricas mensuales</p>
        </div>
      `;
      return;
    }

    const parsed = this.parseSelectedMonthValue(selectedMonth);
    const month = parsed.monthIndex;
    const currentYear = parsed.yearOverride ?? this.getEffectiveYearForMonth(month);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = monthNames[month];

    // Get audits for the selected month
    const audits = DataManager.getAuditsByMonth(currentYear, month);
    const metrics = DataManager.calculateMetrics(audits);
    
    // Calculate active weeks - use configured weeks
    const weeks = DataManager.getWeekConfig(currentYear, month);
    const activeWeeks = weeks.length;

    // Render the content
    this.renderMonthlyMetricsContent(monthName, metrics, activeWeeks, audits, weeks, currentYear, month);
  },

  renderMonthlyMetricsContent(monthName, metrics, activeWeeks, audits, weeks, year, month) {
    const container = document.getElementById('monthlyMetricsContent');
    const isEditor = DataManager.isEditor();
    const userTeam = DataManager.getUserTeam();
    const teams = DataManager.getAllTeams();
    const manualData = DataManager.getWeeklyMetricsData(year, month);
    
    // Get team filter selection (for editors)
    const filterTeamMonthly = document.getElementById('filterTeamMonthly');
    const selectedTeamFilter = filterTeamMonthly ? filterTeamMonthly.value : '';
    
    // Determine which team to show
    let teamToShow = userTeam; // For non-editors, use their assigned team
    if (isEditor && selectedTeamFilter) {
      teamToShow = selectedTeamFilter; // For editors, use selected filter
    }
    
    // If "Todos los Equipos" is selected (no team filter), render each team in its own section
    if (isEditor && !selectedTeamFilter && !userTeam) {
      // Get teams that have members
      const teamsWithMembers = Object.values(teams).filter(team => 
        team.members && team.members.some(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad')
      );
      
      if (teamsWithMembers.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
            <p>No hay equipos con integrantes registrados</p>
          </div>
        `;
        return;
      }
      
      let fullHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-primary);">
            ${monthName} ${year} - Métricas Mensuales - Todos los Equipos
          </h3>
        </div>
      `;
      
      // Render each team in its own section
      teamsWithMembers.forEach(team => {
        const teamAgentsList = team.members
          .filter(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad')
          .map(m => m.name)
          .sort((a, b) => {
            const shiftA = this.getAgentShift(a, teams);
            const shiftB = this.getAgentShift(b, teams);
            return this.getShiftPriority(shiftA) - this.getShiftPriority(shiftB);
          });
        
        if (teamAgentsList.length > 0) {
          fullHTML += this.renderMonthlyMetricsTableForTeam(team.name, team.color, teamAgentsList, audits, weeks, manualData, teams, year, month);
        }
      });
      
      container.innerHTML = fullHTML;
      return;
    }
    
    // Get all agents with their week data
    const allAgents = new Set();
    audits.forEach(audit => allAgents.add(audit.agentName));
    Object.keys(manualData).forEach(agent => allAgents.add(agent));
    
    // Add team members based on filter (exclude supervisors and analistas - they are not auditable)
    if (teamToShow) {
      const team = teams[teamToShow];
      if (team && team.members) {
        team.members.forEach(member => {
          // Exclude supervisors and analistas from metrics
          if (member.role !== 'supervisor' && member.role !== 'analista') {
            allAgents.add(member.name);
          }
        });
      }
    }
    
    let agentsList = Array.from(allAgents).sort();
    
    // Filter by team and exclude supervisors/analistas
    if (teamToShow) {
      const team = teams[teamToShow];
      // Get only non-supervisor/non-analista members
      const teamMemberNames = team && team.members 
        ? team.members.filter(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad').map(m => m.name) 
        : [];
      agentsList = agentsList.filter(agent => teamMemberNames.includes(agent));
    }
    
    // Sort agents by shift priority
    agentsList.sort((a, b) => {
      const shiftA = this.getAgentShift(a, teams);
      const shiftB = this.getAgentShift(b, teams);
      return this.getShiftPriority(shiftA) - this.getShiftPriority(shiftB);
    });
    
    // Get team name for header
    const teamInfo = teamToShow ? teams[teamToShow] : null;
    const teamName = teamInfo ? teamInfo.name : 'Equipo';
    
    let content = `
      <div style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-primary);">
          ${monthName} ${year} - Métricas Mensuales - ${teamName}
        </h3>
      </div>
      
      <div class="table-scroll">
        <table class="data-table" style="font-size: 0.85rem;">
          <thead>
            <tr>
              <th style="min-width: 140px;">Nombre del Agente</th>
              <th style="min-width: 100px; background: rgba(56, 206, 166, 0.1);">Turno</th>
              <th>Tickets</th>
              <th>Tickets x Hora</th>
              <th>Calif. Malos</th>
              <th>Calif. Buena</th>
              <th>T. Resp. (s)</th>
              <th>T. Resol. (m)</th>
              <th>% Calif.</th>
              <th>% Calidad</th>
              <th>% Calif. Positivos</th>
              <th>% Satisfacción</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Process each agent - accumulate totals across ALL weeks
    agentsList.forEach(agentName => {
      // Get agent shift
      const agentShift = this.getAgentShift(agentName, teams);
      const shiftBadge = this.getShiftBadge(agentShift);
      
      // Accumulate data for this agent across all weeks
      let totalTickets = 0;
      let totalTicketsBad = 0;
      let totalTicketsGood = 0;
      let totalFirstResponse = 0;
      let totalResolutionTime = 0;
      let totalTicketsPerHour = 0;
      let ticketsPerHourCount = 0;
      let qualitySum = 0;
      let qualityCount = 0;
      let weekCount = 0;
      
      weeks.forEach((week, weekIndex) => {
        const manual = manualData[agentName] && manualData[agentName][weekIndex] ? manualData[agentName][weekIndex] : {};
        
        // Get quality from audits for this week
        const weekAudits = audits.filter(audit => {
          return audit.agentName === agentName && audit.date >= week.startDate && audit.date <= week.endDate;
        });
        
        // Accumulate manual metrics
        if (manual.tickets || weekAudits.length > 0) {
          totalTickets += manual.tickets || 0;
          totalTicketsBad += manual.ticketsBad || 0;
          totalTicketsGood += manual.ticketsGood || 0;
          totalFirstResponse += manual.firstResponse || 0;
          totalResolutionTime += manual.resolutionTime || 0;
          
          // Accumulate tickets per hour
          if (manual.ticketsPerHour) {
            totalTicketsPerHour += manual.ticketsPerHour;
            ticketsPerHourCount++;
          }
          
          weekCount++;
        }
        
        // Accumulate quality scores
        if (weekAudits.length > 0) {
          const totalScore = weekAudits.reduce((sum, a) => sum + parseFloat(a.score || 0), 0);
          qualitySum += totalScore / weekAudits.length;
          qualityCount++;
        }
      });
      
      // Calculate averages and percentages for the agent
      const avgFirstResponse = weekCount > 0 ? Math.round(totalFirstResponse / weekCount) : 0;
      const avgResolutionTime = weekCount > 0 ? Math.round(totalResolutionTime / weekCount) : 0;
      const avgQuality = qualityCount > 0 ? Math.round(qualitySum / qualityCount) : 0;
      const avgTicketsPerHour = ticketsPerHourCount > 0 ? (totalTicketsPerHour / ticketsPerHourCount).toFixed(1) : '-';
      
      // Calculate % Calif (automatically based on good + bad / total tickets)
      let percentCalif = 0;
      if (totalTickets > 0) {
        percentCalif = ((totalTicketsBad + totalTicketsGood) / totalTickets * 100).toFixed(1);
      }
      
      // Calculate % Calif Positivos (good tickets / total rated tickets)
      let percentCalifPositivos = 0;
      const totalRated = totalTicketsBad + totalTicketsGood;
      if (totalRated > 0) {
        percentCalifPositivos = (totalTicketsGood / totalRated * 100).toFixed(1);
      }
      
      // % Satisfacción (good tickets / total tickets)
      let percentSatisfaccion = 0;
      if (totalTickets > 0) {
        percentSatisfaccion = (totalTicketsGood / totalTickets * 100).toFixed(1);
      }
      
      // Display one row per agent with accumulated totals
      content += `
        <tr>
          <td><strong>${agentName}</strong></td>
          <td style="text-align: center;">${shiftBadge}</td>
          <td style="text-align: center;">${totalTickets || '-'}</td>
          <td style="text-align: center; color: #a855f7; font-weight: 600;">${avgTicketsPerHour}</td>
          <td style="text-align: center;">${totalTicketsBad || '-'}</td>
          <td style="text-align: center;">${totalTicketsGood || '-'}</td>
          <td style="text-align: center;">${avgFirstResponse || '-'}</td>
          <td style="text-align: center;">${avgResolutionTime || '-'}</td>
          <td style="text-align: center; font-weight: 600; color: #0ea5e9;">${percentCalif ? percentCalif + '%' : '-'}</td>
          <td style="text-align: center; color: #38CEA6; font-weight: 600;">${avgQuality || '-'}${avgQuality ? '%' : ''}</td>
          <td style="text-align: center; color: #10b981; font-weight: 600;">${percentCalifPositivos ? percentCalifPositivos + '%' : '-'}</td>
          <td style="text-align: center; color: #0ea5e9; font-weight: 600;">${percentSatisfaccion ? percentSatisfaccion + '%' : '-'}</td>
        </tr>
      `;
    });
    
    // Add totals/averages row
    let grandTotalTickets = 0, grandTotalBad = 0, grandTotalGood = 0;
    let grandTotalFirstResp = 0, grandTotalResol = 0;
    let grandQualitySum = 0, grandQualityCount = 0;
    let agentCount = 0;
    
    agentsList.forEach(agentName => {
      let agentHasData = false;
      let agentTotalFirstResp = 0;
      let agentTotalResol = 0;
      let agentWeekCount = 0;
      
      weeks.forEach((week, weekIndex) => {
        const manual = manualData[agentName] && manualData[agentName][weekIndex] ? manualData[agentName][weekIndex] : {};
        const weekAudits = audits.filter(audit => {
          return audit.agentName === agentName && audit.date >= week.startDate && audit.date <= week.endDate;
        });
        
        if (manual.tickets || weekAudits.length > 0) {
          agentHasData = true;
          grandTotalTickets += manual.tickets || 0;
          grandTotalBad += manual.ticketsBad || 0;
          grandTotalGood += manual.ticketsGood || 0;
          agentTotalFirstResp += manual.firstResponse || 0;
          agentTotalResol += manual.resolutionTime || 0;
          agentWeekCount++;
        }
        
        if (weekAudits.length > 0) {
          const totalScore = weekAudits.reduce((sum, a) => sum + parseFloat(a.score || 0), 0);
          grandQualitySum += totalScore / weekAudits.length;
          grandQualityCount++;
        }
      });
      
      if (agentHasData) {
        agentCount++;
        if (agentWeekCount > 0) {
          grandTotalFirstResp += agentTotalFirstResp / agentWeekCount;
          grandTotalResol += agentTotalResol / agentWeekCount;
        }
      }
    });
    
    const avgFirstResp = agentCount > 0 ? Math.round(grandTotalFirstResp / agentCount) : 0;
    const avgResol = agentCount > 0 ? Math.round(grandTotalResol / agentCount) : 0;
    const avgQuality = grandQualityCount > 0 ? Math.round(grandQualitySum / grandQualityCount) : 0;
    const grandTotalRated = grandTotalBad + grandTotalGood;
    const percentCalifTotal = grandTotalTickets > 0 ? ((grandTotalRated / grandTotalTickets) * 100).toFixed(1) : 0;
    const percentCalifPositivosTotal = grandTotalRated > 0 ? ((grandTotalGood / grandTotalRated) * 100).toFixed(1) : 0;
    const percentSatisfaccionTotal = grandTotalTickets > 0 ? ((grandTotalGood / grandTotalTickets) * 100).toFixed(1) : 0;
    
    content += `
            <tr style="background: #f0fdf4; font-weight: 700;">
              <td><strong>PROMEDIO / TOTAL</strong></td>
              <td style="text-align: center;">${grandTotalTickets}</td>
              <td style="text-align: center;">${grandTotalBad}</td>
              <td style="text-align: center;">${grandTotalGood}</td>
              <td style="text-align: center;">${avgFirstResp}</td>
              <td style="text-align: center;">${avgResol}</td>
              <td style="text-align: center;">${percentCalifTotal}%</td>
              <td style="text-align: center; color: #38CEA6;">${avgQuality}%</td>
              <td style="text-align: center; color: #10b981;">${percentCalifPositivosTotal}%</td>
              <td style="text-align: center; color: #0ea5e9;">${percentSatisfaccionTotal}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    
    container.innerHTML = content;
  },

  // Helper function to render monthly metrics table for a single team
  renderMonthlyMetricsTableForTeam(teamName, teamColor, agentsList, audits, weeks, manualData, teams, year, month) {
    if (agentsList.length === 0) return '';
    
    let tableHTML = `
      <div style="margin-bottom: 2rem; border: 2px solid ${teamColor}; border-radius: 0.75rem; overflow: visible;">
        <div style="background: ${teamColor}; color: white; padding: 0.75rem 1rem;">
          <h4 style="margin: 0; font-size: 1rem; font-weight: 700;">
            <i class="fas fa-users"></i> ${teamName}
          </h4>
        </div>
        
        <div class="table-scroll">
          <table class="data-table" style="font-size: 0.85rem; margin: 0;">
            <thead>
              <tr>
                <th style="min-width: 140px;">Nombre del Agente</th>
                <th style="min-width: 100px; background: rgba(56, 206, 166, 0.1);">Turno</th>
                <th>Tickets</th>
                <th>Tickets x Hora</th>
                <th>Calif. Malos</th>
                <th>Calif. Buena</th>
                <th>T. Resp. (s)</th>
                <th>T. Resol. (m)</th>
                <th>% Calif.</th>
                <th>% Calidad</th>
                <th>% Calif. Positivos</th>
                <th>% Satisfacción</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    // Process each agent
    agentsList.forEach(agentName => {
      const agentShift = this.getAgentShift(agentName, teams);
      const shiftBadge = this.getShiftBadge(agentShift);
      
      // Accumulate data for this agent across all weeks
      let totalTickets = 0;
      let totalTicketsBad = 0;
      let totalTicketsGood = 0;
      let totalFirstResponse = 0;
      let totalResolutionTime = 0;
      let totalTicketsPerHour = 0;
      let ticketsPerHourCount = 0;
      let qualitySum = 0;
      let qualityCount = 0;
      let weekCount = 0;
      
      weeks.forEach((week, weekIndex) => {
        const manual = manualData[agentName] && manualData[agentName][weekIndex] ? manualData[agentName][weekIndex] : {};
        
        // Get quality from audits for this week
        const weekAudits = audits.filter(audit => {
          return audit.agentName === agentName && audit.date >= week.startDate && audit.date <= week.endDate;
        });
        
        // Accumulate manual metrics
        if (manual.tickets || weekAudits.length > 0) {
          totalTickets += manual.tickets || 0;
          totalTicketsBad += manual.ticketsBad || 0;
          totalTicketsGood += manual.ticketsGood || 0;
          totalFirstResponse += manual.firstResponse || 0;
          totalResolutionTime += manual.resolutionTime || 0;
          
          if (manual.ticketsPerHour) {
            totalTicketsPerHour += manual.ticketsPerHour;
            ticketsPerHourCount++;
          }
          
          weekCount++;
        }
        
        // Accumulate quality scores
        if (weekAudits.length > 0) {
          const totalScore = weekAudits.reduce((sum, a) => sum + parseFloat(a.score || 0), 0);
          qualitySum += totalScore / weekAudits.length;
          qualityCount++;
        }
      });
      
      // Calculate averages and percentages
      const avgFirstResponse = weekCount > 0 ? Math.round(totalFirstResponse / weekCount) : 0;
      const avgResolutionTime = weekCount > 0 ? Math.round(totalResolutionTime / weekCount) : 0;
      const avgQuality = qualityCount > 0 ? Math.round(qualitySum / qualityCount) : 0;
      const avgTicketsPerHour = ticketsPerHourCount > 0 ? (totalTicketsPerHour / ticketsPerHourCount).toFixed(1) : '-';
      
      let percentCalif = 0;
      if (totalTickets > 0) {
        percentCalif = ((totalTicketsBad + totalTicketsGood) / totalTickets * 100).toFixed(1);
      }
      
      let percentCalifPositivos = 0;
      const totalRated = totalTicketsBad + totalTicketsGood;
      if (totalRated > 0) {
        percentCalifPositivos = (totalTicketsGood / totalRated * 100).toFixed(1);
      }
      
      let percentSatisfaction = 0;
      if (totalTickets > 0) {
        percentSatisfaction = (totalTicketsGood / totalTickets * 100).toFixed(1);
      }
      
      tableHTML += `
        <tr>
          <td><strong>${agentName}</strong></td>
          <td>${shiftBadge}</td>
          <td style="text-align: center;">${totalTickets || '-'}</td>
          <td style="text-align: center; color: #8b5cf6;">${avgTicketsPerHour}</td>
          <td style="text-align: center;">${totalTicketsBad || '-'}</td>
          <td style="text-align: center;">${totalTicketsGood || '-'}</td>
          <td style="text-align: center;">${avgFirstResponse || '-'}</td>
          <td style="text-align: center;">${avgResolutionTime || '-'}</td>
          <td style="text-align: center;">${percentCalif > 0 ? percentCalif + '%' : '-'}</td>
          <td style="text-align: center; color: #38CEA6; font-weight: 600;">${avgQuality > 0 ? avgQuality + '%' : '-'}</td>
          <td style="text-align: center; color: #10b981;">${percentCalifPositivos > 0 ? percentCalifPositivos + '%' : '-'}</td>
          <td style="text-align: center; color: #0ea5e9;">${percentSatisfaction > 0 ? percentSatisfaction + '%' : '-'}</td>
        </tr>
      `;
    });
    
    tableHTML += `</tbody></table></div></div>`;
    
    return tableHTML;
  },

  renderMonthlyChart(weeks, audits) {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

    // Destroy existing chart
    if (this.charts.monthly) {
      this.charts.monthly.destroy();
    }
    
    const labels = weeks.map((w, i) => `Sem ${i + 1}`);
    const counts = [];
    const avgScores = [];
    
    // Calculate metrics for each week
    weeks.forEach(week => {
      const weekAudits = audits.filter(audit => {
        return audit.date >= week.startDate && audit.date <= week.endDate;
      });
      
      counts.push(weekAudits.length);
      
      if (weekAudits.length === 0) {
        avgScores.push(0);
      } else {
        const totalScore = weekAudits.reduce((sum, audit) => sum + parseFloat(audit.score || 0), 0);
        avgScores.push((totalScore / weekAudits.length).toFixed(1));
      }
    });

    this.charts.monthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Auditorías por Semana',
            data: counts,
            backgroundColor: 'rgba(56, 206, 166, 0.7)',
            borderColor: '#38CEA6',
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Puntuación Promedio',
            data: avgScores,
            type: 'line',
            borderColor: '#0b8f6a',
            backgroundColor: 'rgba(11, 143, 106, 0.1)',
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Cantidad'
            },
            beginAtZero: true
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Puntuación'
            },
            min: 0,
            max: 100,
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
  },

  // Utility functions for audit scoring
  countCheckedCriteria(criteriaIds) {
    let checked = 0;
    criteriaIds.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox && checkbox.checked) checked++;
    });
    return checked;
  },

  calculateScore() {
    // Define criteria for each section
    const empatiaCriteria = ['metodoRided', 'lenguajePositivo', 'acompanamiento', 'personalizacion', 'estructura', 'usoIaOrtografia'];
    const gestionTicketCriteria = ['estadosTicket', 'ausenciaCliente', 'validacionHistorial', 'tipificacionCriterio', 'retencionTickets', 'tiempoRespuesta', 'tiempoGestion'];
    const conocimientoCriteria = ['serviciosPromociones', 'informacionVeraz', 'parlamentosContingencia', 'honestidadTransparencia'];
    const herramientasCriteria = ['rideryOffice', 'adminZendesk', 'driveManuales', 'slack', 'generacionReportes', 'cargaIncidencias'];
    
    // Count errors per section
    const countErrors = (criteria) => {
      let errors = 0;
      for (const criterionId of criteria) {
        const checkbox = document.getElementById(criterionId);
        if (checkbox && !checkbox.checked) {
          errors++;
        }
      }
      return errors;
    };
    
    const empatiaErrors = countErrors(empatiaCriteria);
    const gestionTicketErrors = countErrors(gestionTicketCriteria);
    const conocimientoErrors = countErrors(conocimientoCriteria);
    const herramientasErrors = countErrors(herramientasCriteria);

    // Calculate Empatía (50% total) - apply 2-error rule
    let empatiaChecked, empatiaPercent, empatiaTotalPercent;
    if (empatiaErrors >= 2) {
      empatiaChecked = 0;
      empatiaPercent = 0;
      empatiaTotalPercent = 0;
    } else {
      empatiaChecked = this.countCheckedCriteria(empatiaCriteria);
      empatiaPercent = (empatiaChecked / empatiaCriteria.length) * 100;
      empatiaTotalPercent = (empatiaChecked / empatiaCriteria.length) * 50;
    }
    
    // Calculate Gestión subsections (each 33.33% of 50% = 16.67% of total)
    let gestionTicketScore, conocimientoScore, herramientasScore;
    
    // Gestión de ticket (16.67% of total)
    if (gestionTicketErrors >= 2) {
      gestionTicketScore = 0;
    } else {
      const gestionTicketChecked = this.countCheckedCriteria(gestionTicketCriteria);
      gestionTicketScore = (gestionTicketChecked / gestionTicketCriteria.length) * 16.67;
    }
    
    // Conocimiento Integral (16.67% of total)
    if (conocimientoErrors >= 2) {
      conocimientoScore = 0;
    } else {
      const conocimientoChecked = this.countCheckedCriteria(conocimientoCriteria);
      conocimientoScore = (conocimientoChecked / conocimientoCriteria.length) * 16.67;
    }
    
    // Herramientas (16.67% of total)
    if (herramientasErrors >= 2) {
      herramientasScore = 0;
    } else {
      const herramientasChecked = this.countCheckedCriteria(herramientasCriteria);
      herramientasScore = (herramientasChecked / herramientasCriteria.length) * 16.67;
    }
    
    // Total gestión
    const gestionTotalPercent = gestionTicketScore + conocimientoScore + herramientasScore;
    const gestionPercent = (gestionTotalPercent / 50) * 100;
    
    // Total score
    const totalScore = Math.round(empatiaTotalPercent + gestionTotalPercent);
    
    // Update displays
    document.getElementById('empatiaPercent').textContent = Math.round(empatiaPercent) + '%';
    document.getElementById('empatiaTotalPercent').textContent = Math.round(empatiaTotalPercent) + '%';
    document.getElementById('empatiaFinalPercent').textContent = Math.round(empatiaTotalPercent) + '%';
    
    document.getElementById('gestionPercent').textContent = Math.round(gestionPercent) + '%';
    document.getElementById('gestionTotalPercent').textContent = Math.round(gestionTotalPercent) + '%';
    document.getElementById('gestionFinalPercent').textContent = Math.round(gestionTotalPercent) + '%';
    
    document.getElementById('totalScoreDisplay').textContent = totalScore;
    document.getElementById('calculatedScore').value = totalScore;
    
    // Store individual scores
    document.getElementById('empatiaScore').value = Math.round(empatiaTotalPercent);
    document.getElementById('gestionScore').value = Math.round(gestionTotalPercent);
    
    // Update subcategory "Marcar" checkboxes
    this.updateSubcategoryCheckboxes();
  },

  updateSubcategoryCheckboxes() {
    // Update Gestión de ticket checkbox
    const gestionTicketAll = document.getElementById('gestionTicketAll');
    if (gestionTicketAll) {
      const gestionTicketCheckboxes = document.querySelectorAll('.gestionTicket');
      const allChecked = Array.from(gestionTicketCheckboxes).every(cb => cb.checked);
      gestionTicketAll.checked = allChecked;
    }
    
    // Update Conocimiento Integral checkbox
    const conocimientoAll = document.getElementById('conocimientoIntegralAll');
    if (conocimientoAll) {
      const conocimientoCheckboxes = document.querySelectorAll('.conocimientoIntegral');
      const allChecked = Array.from(conocimientoCheckboxes).every(cb => cb.checked);
      conocimientoAll.checked = allChecked;
    }
    
    // Update Herramientas checkbox
    const herramientasAll = document.getElementById('herramientasAll');
    if (herramientasAll) {
      const herramientasCheckboxes = document.querySelectorAll('.herramientas');
      const allChecked = Array.from(herramientasCheckboxes).every(cb => cb.checked);
      herramientasAll.checked = allChecked;
    }
  },

  toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const iconId = sectionId.replace('Section', 'ToggleIcon');
    const icon = document.getElementById(iconId);
    
    if (section.style.display === 'none') {
      section.style.display = 'block';
      icon.className = 'fas fa-chevron-up';
    } else {
      section.style.display = 'none';
      icon.className = 'fas fa-chevron-down';
    }
  },

  toggleAllCheckboxes(groupName, checked) {
    const checkboxes = document.querySelectorAll(`input[name="${groupName}"]`);
    checkboxes.forEach(checkbox => {
      checkbox.checked = checked;
    });
    this.calculateScore();
  },
  
  toggleSubcategory(className, checked) {
    const checkboxes = document.querySelectorAll(`.${className}`);
    checkboxes.forEach(checkbox => {
      checkbox.checked = checked;
    });
    this.calculateScore();
  },

  // Week Configuration Modal
  openWeekConfigModal() {
    const filterMonthMetrics = document.getElementById('filterMonthMetrics');
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    if (!filterMonthMetrics) {
      alert('No se encontró el selector de mes.');
      return;
    }

    if (!filterMonthMetrics.value) {
      const monthInput = prompt('Ingrese el mes a configurar (1-12):');
      const parsed = parseInt(monthInput);
      if (isNaN(parsed) || parsed < 1 || parsed > 12) {
        alert('Mes inválido. Use un número entre 1 y 12.');
        return;
      }
      const monthIndexPrompt = parsed - 1;
      const optionExists = Array.from(filterMonthMetrics.options).some(opt => parseInt(opt.value) === monthIndexPrompt);
      if (!optionExists) {
        const opt = document.createElement('option');
        opt.value = monthIndexPrompt;
        opt.textContent = monthNames[monthIndexPrompt];
        filterMonthMetrics.appendChild(opt);
      }
      filterMonthMetrics.value = monthIndexPrompt;
    }

    const parsedSel = this.parseSelectedMonthValue(filterMonthMetrics.value);
    const month = parsedSel.monthIndex;
    const currentYear = parsedSel.yearOverride ?? this.getEffectiveYearForMonth(month);
    
    // Get current week configuration
    let weeks = DataManager.getWeekConfig(currentYear, month);
    if (!weeks.length) {
      weeks = DataManager.ensureWeekConfig(currentYear, month);
    }
    
    let content = `
      <div style="background: #fef3f2; padding: 1rem; border-radius: 0.75rem; margin-bottom: 1rem;">
        <p style="margin: 0; font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
          Mes: ${monthNames[month]} ${currentYear}
        </p>
      </div>
    `;
    
    weeks.forEach((week, index) => {
      content += `
        <div class="week-config-item" data-week-index="${index}" style="background: #f9fafb; padding: 1rem; border-radius: 0.75rem; margin-bottom: 1rem; border-left: 3px solid #38CEA6; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0;">
              Semana ${index + 1}
            </h4>
            ${weeks.length > 1 ? `
              <button type="button" class="delete-week-btn" data-week-index="${index}" style="background: #fee2e2; color: #dc2626; border: none; padding: 0.4rem 0.8rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
                <i class="fas fa-trash"></i> Eliminar
              </button>
            ` : ''}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label class="label-small">Fecha de Inicio</label>
              <input type="date" class="input-dark week-start-date" data-index="${index}" value="${week.startDate}">
            </div>
            <div>
              <label class="label-small">Fecha de Fin</label>
              <input type="date" class="input-dark week-end-date" data-index="${index}" value="${week.endDate}">
            </div>
          </div>
        </div>
      `;
    });
    
    content += `
      <button type="button" class="btn-accent" id="addWeekBtn" style="width: 100%; background: #f3f4f6; color: var(--text-primary); border: 1px dashed #d1d5db; margin-top: 0.5rem;">
        <i class="fas fa-plus"></i> Agregar Semana
      </button>
    `;
    
    document.getElementById('weekConfigContent').innerHTML = content;
    document.getElementById('weekConfigModal').classList.remove('hidden');
    
    // Add event listener for delete week buttons
    document.querySelectorAll('.delete-week-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Get the button element (might click on icon inside)
        const button = e.currentTarget;
        const weekIndex = parseInt(button.getAttribute('data-week-index'));
        const parsed = App.parseSelectedMonthValue(filterMonthMetrics.value);
        const month = parsed.monthIndex;
        const currentYear = parsed.yearOverride ?? App.getEffectiveYearForMonth(month);
        
        console.log(`Delete button clicked: weekIndex=${weekIndex}, month=${month}, year=${currentYear}`);
        
        if (confirm(`¿Está seguro que desea eliminar la Semana ${weekIndex + 1}?`)) {
          const success = DataManager.deleteWeekFromConfig(currentYear, month, weekIndex);
          if (success) {
            // Refresh the modal - use App reference instead of this
            App.openWeekConfigModal();
          }
          // Error messages are now shown by deleteWeekFromConfig function
        }
      });
    });
    
    // Add event listener for add week button
    document.getElementById('addWeekBtn').addEventListener('click', () => {
      const container = document.getElementById('weekConfigContent');
      const weekCount = container.querySelectorAll('.week-start-date').length;
      const parsed = App.parseSelectedMonthValue(filterMonthMetrics.value);
      const month = parsed.monthIndex;
      const currentYear = parsed.yearOverride ?? App.getEffectiveYearForMonth(month);

      let nextStart;
      if (weekCount === 0) {
        nextStart = new Date(currentYear, month, 1);
      } else {
        const lastEndDate = container.querySelector(`.week-end-date[data-index="${weekCount - 1}"]`).value;
        nextStart = new Date(lastEndDate);
        nextStart.setDate(nextStart.getDate() + 1);
      }

      const nextEnd = new Date(nextStart);
      nextEnd.setDate(nextEnd.getDate() + 6);
      
      const y1 = nextStart.getFullYear();
      const m1 = String(nextStart.getMonth() + 1).padStart(2, '0');
      const d1 = String(nextStart.getDate()).padStart(2, '0');
      const y2 = nextEnd.getFullYear();
      const m2 = String(nextEnd.getMonth() + 1).padStart(2, '0');
      const d2 = String(nextEnd.getDate()).padStart(2, '0');

      const newWeekHTML = `
        <div style="background: #f9fafb; padding: 1rem; border-radius: 0.75rem; margin-bottom: 1rem; border-left: 3px solid #38CEA6;">
          <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 0.75rem 0;">
            Semana ${weekCount + 1}
          </h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label class="label-small">Fecha de Inicio</label>
              <input type="date" class="input-dark week-start-date" data-index="${weekCount}" value="${y1}-${m1}-${d1}">
            </div>
            <div>
              <label class="label-small">Fecha de Fin</label>
              <input type="date" class="input-dark week-end-date" data-index="${weekCount}" value="${y2}-${m2}-${d2}">
            </div>
          </div>
        </div>
      `;
      
      document.getElementById('addWeekBtn').insertAdjacentHTML('beforebegin', newWeekHTML);
    });
  },

  closeWeekConfigModal() {
    document.getElementById('weekConfigModal').classList.add('hidden');
  },

  saveWeekConfig() {
    const filterMonthMetrics = document.getElementById('filterMonthMetrics');
    const parsed = this.parseSelectedMonthValue(filterMonthMetrics.value);
    const month = parsed.monthIndex;
    const currentYear = parsed.yearOverride ?? this.getEffectiveYearForMonth(month);
    
    const startDates = document.querySelectorAll('.week-start-date');
    const endDates = document.querySelectorAll('.week-end-date');
    
    const weeks = [];
    startDates.forEach((startInput, index) => {
      weeks.push({
        weekNumber: index + 1,
        startDate: startInput.value,
        endDate: endDates[index].value,
        label: `Semana ${startInput.value} al ${endDates[index].value}`
      });
    });
    
    DataManager.saveWeekConfig(currentYear, month, weeks);
    this.closeWeekConfigModal();
    this.populateMonthSelectors();
    document.getElementById('filterMonthMetrics').value = month;
    this.loadWeeklyMetrics();
    alert('Configuración de semanas guardada exitosamente');
  },

  // Manual Metrics Modal
  openManualMetricsModal(agentName, weekIndex, year, month) {
    const weeks = DataManager.getWeekConfig(year, month);
    const week = weeks[weekIndex];
    
    document.getElementById('metricsAgentName').textContent = agentName;
    document.getElementById('metricsWeekRange').textContent = `${week.startDate} al ${week.endDate}`;
    document.getElementById('metricsYear').value = year;
    document.getElementById('metricsMonth').value = month;
    document.getElementById('metricsWeekIndex').value = weekIndex;
    document.getElementById('metricsAgentKey').value = agentName;
    
    // Load existing data
    const manualData = DataManager.getWeeklyMetricsData(year, month);
    const agentData = manualData[agentName] && manualData[agentName][weekIndex] ? manualData[agentName][weekIndex] : {};
    
    document.getElementById('metricTickets').value = agentData.tickets || 0;
    document.getElementById('metricTicketsBad').value = agentData.ticketsBad || 0;
    document.getElementById('metricTicketsGood').value = agentData.ticketsGood || 0;
    document.getElementById('metricFirstResponse').value = agentData.firstResponse || 0;
    document.getElementById('metricResolutionTime').value = agentData.resolutionTime || 0;
    document.getElementById('metricTicketsPerHour').value = agentData.ticketsPerHour || 0;
    
    document.getElementById('manualMetricsModal').classList.remove('hidden');
  },

  closeManualMetricsModal() {
    document.getElementById('manualMetricsModal').classList.add('hidden');
  },

  handleManualMetricsSubmit(e) {
    e.preventDefault();
    
    const year = parseInt(document.getElementById('metricsYear').value);
    const month = parseInt(document.getElementById('metricsMonth').value);
    const weekIndex = parseInt(document.getElementById('metricsWeekIndex').value);
    const agentName = document.getElementById('metricsAgentKey').value;
    
    const metricsData = {
      tickets: parseInt(document.getElementById('metricTickets').value) || 0,
      ticketsBad: parseInt(document.getElementById('metricTicketsBad').value) || 0,
      ticketsGood: parseInt(document.getElementById('metricTicketsGood').value) || 0,
      firstResponse: parseFloat(document.getElementById('metricFirstResponse').value) || 0,
      resolutionTime: parseFloat(document.getElementById('metricResolutionTime').value) || 0,
      ticketsPerHour: parseFloat(document.getElementById('metricTicketsPerHour').value) || 0
    };
    
    // Get current data
    const allData = DataManager.getWeeklyMetricsData(year, month);
    
    // Initialize agent data if doesn't exist
    if (!allData[agentName]) {
      allData[agentName] = {};
    }
    
    // Save metrics for this week
    allData[agentName][weekIndex] = metricsData;
    
    // Save back to storage
    DataManager.saveWeeklyMetricsData(year, month, allData);
    
    this.closeManualMetricsModal();
    this.loadWeeklyMetrics();
    
    alert('Métricas guardadas exitosamente');
  },

  updateShiftLabel(agentName, weekIndex, shiftValue, year, month) {
    // Get current data
    const allData = DataManager.getWeeklyMetricsData(year, month);
    
    // Initialize agent data if doesn't exist
    if (!allData[agentName]) {
      allData[agentName] = {};
    }
    
    // Initialize week data if doesn't exist
    if (!allData[agentName][weekIndex]) {
      allData[agentName][weekIndex] = {
        tickets: 0,
        ticketsBad: 0,
        ticketsGood: 0,
        firstResponse: 0,
        resolutionTime: 0
      };
    }
    
    // Update shift value
    allData[agentName][weekIndex].shift = shiftValue;
    
    // Save back to storage
    DataManager.saveWeeklyMetricsData(year, month, allData);
    
    // Optionally reload to show changes (but not necessary as the input already shows the new value)
    // this.loadMonthlyMetrics();
  },

  // Observation field management for criteria
  toggleObservationField(criterionId) {
    const checkbox = document.getElementById(criterionId);
    const obsField = document.getElementById(`obs-${criterionId}`);
    
    if (!checkbox || !obsField) return;
    
    // Show observation field when checkbox is UNCHECKED (error)
    if (!checkbox.checked) {
      obsField.style.display = 'block';
    } else {
      obsField.style.display = 'none';
      // Clear observation when checked (no error)
      const textarea = obsField.querySelector('textarea');
      if (textarea) textarea.value = '';
    }
  },

  showObservationField(criterionId) {
    const obsField = document.getElementById(`obs-${criterionId}`);
    if (obsField) {
      obsField.style.display = 'block';
      // Focus on the textarea
      const textarea = obsField.querySelector('textarea');
      if (textarea) textarea.focus();
    }
  },

  // Connection Hours functionality
  initializeConnectionHoursFilters() {
    const teams = DataManager.getAllTeams();
    const userTeam = DataManager.getUserTeam();
    const isEditor = DataManager.isEditor();
    const hasSupervisorPerms = DataManager.hasSupervisorPermissions();
    
    // Populate team filter
    const filterTeamConnectionHours = document.getElementById('filterTeamConnectionHours');
    if (filterTeamConnectionHours) {
      // Clear existing options except the first one
      while (filterTeamConnectionHours.options.length > 1) {
        filterTeamConnectionHours.remove(1);
      }
      
      Object.values(teams).forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        filterTeamConnectionHours.appendChild(option);
      });

      // Para usuarios sin permisos (ni editor ni supervisor/analista), restringir a su equipo
      if (!isEditor && !hasSupervisorPerms && userTeam) {
        filterTeamConnectionHours.value = userTeam;
        filterTeamConnectionHours.disabled = true;
      } else {
        // Editores y supervisores/analistas pueden seleccionar equipo
        filterTeamConnectionHours.disabled = false;
      }
    }
  },

  openConnectionHoursImportModal() {
    const filterMonthConnectionHours = document.getElementById('filterMonthConnectionHours');
    const selectedMonth = filterMonthConnectionHours ? filterMonthConnectionHours.value : '';
    const selectedTeam = document.getElementById('filterTeamConnectionHours') ? document.getElementById('filterTeamConnectionHours').value : '';
    const selectedTeamLabel = document.getElementById('filterTeamConnectionHours') ? document.getElementById('filterTeamConnectionHours').selectedOptions[0].textContent : '';
    
    if (selectedMonth === '') {
      alert('Seleccione primero el mes y luego abra el modal de importación.');
      return;
    }


    const parsed = this.parseSelectedMonthValue(selectedMonth);
    const monthIndex = parsed.monthIndex;
    const effectiveYear = parsed.yearOverride ?? this.getEffectiveYearForMonth(monthIndex);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const weeks = DataManager.ensureWeekConfig(effectiveYear, monthIndex) || [];

    const weekSelect = document.getElementById('connectionHoursWeekSelect');
    if (weekSelect) {
      weekSelect.innerHTML = weeks.map((week, idx) => `<option value="${idx}">Semana ${idx + 1}: ${week.startDate} al ${week.endDate}</option>`).join('');
    }

    const dayWrapper = document.getElementById('connectionHoursDayWrapper');
    const rangeWrapper = document.getElementById('connectionHoursRangeWrapper');
    const importModeSelect = document.getElementById('connectionHoursImportMode');
    const weekSelectContainer = weekSelect ? weekSelect.parentElement : null;
    const rangeStartInput = document.getElementById('connectionHoursRangeStart');
    const rangeEndInput = document.getElementById('connectionHoursRangeEnd');
    const toggleWrappers = () => {
      if (!importModeSelect) return;
      const mode = importModeSelect.value;
      if (dayWrapper) dayWrapper.style.display = mode === 'dia' ? 'block' : 'none';
      if (rangeWrapper) rangeWrapper.style.display = mode === 'rango' ? 'block' : 'none';
      if (weekSelectContainer) weekSelectContainer.style.display = mode === 'rango' ? 'none' : 'block';
    };
    // Defaults de rango: cubrir semanas del mes visible
    if (weeks && weeks.length > 0) {
      if (rangeStartInput && !rangeStartInput.value) rangeStartInput.value = weeks[0].startDate;
      if (rangeEndInput && !rangeEndInput.value) rangeEndInput.value = weeks[weeks.length - 1].endDate;
    }
    toggleWrappers();
    if (importModeSelect) {
      importModeSelect.onchange = () => toggleWrappers();
    }

    // Rellenar selector de día según la semana elegida
    const daySelect = document.getElementById('connectionHoursDaySelect');
    const fillDays = (wIdx) => {
      if (!daySelect) return;
      const w = weeks[wIdx];
      if (!w) { daySelect.innerHTML = '<option value="">Seleccione semana para listar días</option>'; return; }
      const start = this.parseLocalDate(w.startDate);
      const end = this.parseLocalDate(w.endDate);
      const current = new Date(start);
      const names = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
      const opts = [];
      while (current <= end) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth()+1).padStart(2,'0');
        const dd = String(current.getDate()).padStart(2,'0');
        const iso = `${yyyy}-${mm}-${dd}`;
        opts.push(`<option value="${iso}">${names[current.getDay()]} ${dd}/${mm}</option>`);
        current.setDate(current.getDate()+1);
      }
      daySelect.innerHTML = `<option value="">Seleccione un día...</option>` + opts.join('');
    };
    fillDays(parseInt(weekSelect?.value || '0') || 0);
    if (weekSelect) {
      weekSelect.onchange = () => fillDays(parseInt(weekSelect.value || '0') || 0);
    }

    const monthInput = document.getElementById('connectionHoursSelectedMonth');
    if (monthInput) {
      monthInput.value = `${monthNames[monthIndex]} ${effectiveYear}`;
    }

    const teamInput = document.getElementById('connectionHoursSelectedTeam');
    if (teamInput) {
      // En la UI el valor vacío representa "Todos los Equipos"
      teamInput.value = selectedTeamLabel || 'Todos los Equipos';
    }

    const modal = document.getElementById('connectionHoursImportModal');
    modal.style.display = 'flex';
    document.getElementById('connectionHoursPasteArea').value = '';
    
    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.closeConnectionHoursImportModal();
      }
    };
  },

  closeConnectionHoursImportModal() {
    const modal = document.getElementById('connectionHoursImportModal');
    modal.style.display = 'none';
  },

  importConnectionHours() {
    const pasteArea = document.getElementById('connectionHoursPasteArea');
    const data = pasteArea.value.trim();
    
    if (!data) {
      alert('Por favor pegue los datos antes de importar.');
      return;
    }

    const selectedMonth = document.getElementById('filterMonthConnectionHours').value;
    const selectedTeam = document.getElementById('filterTeamConnectionHours').value;
    const selectedWeek = document.getElementById('connectionHoursWeekSelect') ? document.getElementById('connectionHoursWeekSelect').value : '';
    let importMode = document.getElementById('connectionHoursImportMode') ? document.getElementById('connectionHoursImportMode').value : 'semana';
    const selectedDate = document.getElementById('connectionHoursDaySelect') ? document.getElementById('connectionHoursDaySelect').value : '';
    const rangeStart = document.getElementById('connectionHoursRangeStart') ? document.getElementById('connectionHoursRangeStart').value : '';
    const rangeEnd = document.getElementById('connectionHoursRangeEnd') ? document.getElementById('connectionHoursRangeEnd').value : '';
    
    if (selectedMonth === '') {
      alert('Por favor seleccione un mes antes de importar.');
      return;
    }

    if (importMode !== 'rango' && selectedWeek === '') {
      alert('Por favor seleccione la semana destino antes de importar.');
      return;
    }

    if (importMode === 'dia' && !selectedDate) {
      alert('Seleccione el día específico para la carga por día.');
      return;
    }

    if (importMode === 'rango') {
      if (!rangeStart || !rangeEnd) {
        alert('Indique el rango de fechas (desde y hasta) para importar por rango.');
        return;
      }
      const rs = this.parseLocalDate(rangeStart);
      const re = this.parseLocalDate(rangeEnd);
      if (isNaN(rs.getTime()) || isNaN(re.getTime()) || rs > re) {
        alert('Rango de fechas inválido. Verifique las fechas desde/hasta.');
        return;
      }
    }

    const lines = data.split('\n');
    if (lines.length < 2) {
      alert('Los datos parecen estar vacíos o mal formateados.');
      return;
    }

    // Detectar formato export "estado" (ej. con fecha, nombre, canal, estado, hora inicio/fin y posible duración)
    const header = lines[0].toLowerCase();
    const isStateExportFormat =
      header.includes('nombre del agente') &&
      header.includes('estado') &&
      (header.includes('fecha') || header.includes('hora de inicio'));
    if (importMode === 'rango' && !isStateExportFormat) {
      alert('Para importar por rango se requiere el formato con columna de fecha por fila (estado).');
      return;
    }

    // Get week configuration to know the dates
    const parsedMonthSel = this.parseSelectedMonthValue(selectedMonth);
    const monthIndex = parsedMonthSel.monthIndex;
    const weekIndex = parseInt(selectedWeek);
    const effectiveYear = parsedMonthSel.yearOverride ?? this.getEffectiveYearForMonth(monthIndex);
    let weeks = DataManager.getWeekConfig(effectiveYear, monthIndex);
    let week = weeks ? weeks[weekIndex] : null;
    let weekDateSet = new Set();
    if (importMode !== 'rango') {
      if (!week) {
        alert('No se encontró la configuración de la semana seleccionada.');
        return;
      }
      const weekDates = [];
      const startDate = this.parseLocalDate(week.startDate);
      const endDate = this.parseLocalDate(week.endDate);
      const current = new Date(startDate);
      while (current <= endDate) {
        weekDates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weekDateSet = new Set(weekDates.map(d => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }));
    }
    let rangeDateSet = new Set();
    if (importMode === 'rango') {
      const rs = this.parseLocalDate(rangeStart);
      const re = this.parseLocalDate(rangeEnd);
      const cur = new Date(rs);
      while (cur <= re) {
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        rangeDateSet.add(`${yyyy}-${mm}-${dd}`);
        cur.setDate(cur.getDate() + 1);
      }
    }

    const teams = DataManager.getAllTeams();
    const eligibleNameSet = new Set();
    const nameToTeamId = {}; // nombre exacto -> teamId
    const includeTeam = (teamId) => {
      const team = teams[teamId];
      if (!team || !team.members) return;
      team.members.forEach(m => {
        if (m.role === 'supervisor' || m.role === 'analista' || m.role === 'calidad') return;
        if (!m.name) return;
        eligibleNameSet.add(m.name);
        // Guardar la primera ocurrencia (si existiese duplicado de nombres)
        if (!nameToTeamId[m.name]) nameToTeamId[m.name] = teamId;
      });
    };
    // En la UI: value "" = "Todos los Equipos".
    if (selectedTeam === '' || selectedTeam === 'all') {
      Object.keys(teams).forEach(includeTeam);
    } else {
      includeTeam(selectedTeam);
    }
    const teamMemberNames = Array.from(eligibleNameSet);

    // Formatos admitidos:
    // Semana: Encabezados + filas (Agente | Lunes | ... | Domingo)
    // Día: Encabezados + filas (Agente | Horas/Libre/VACACIONES/CAMBIO/GUARDIA)
    // Estado/segundos: columnas con fecha, nombre, canal, estado, hora inicio/fin, segundos (se suman por día)
    
    let imported = 0;
    const agentData = {};
    const aggregatedSeconds = {}; // { agentName: { dateStr: totalSeconds } }
    const sumSeenByAgentDate = {}; // { agentName: { isoDate: true } }
    
    // Skip header rows (usually 2-3 rows of headers)
    let dataStartIndex = 0;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('nombre del agente') || line.includes('lunes') || line.includes('semana')) {
        dataStartIndex = i + 1;
      }
    }
    
    // Para formato export estado NO forzamos el modo: si el usuario eligió rango, se respeta.

    // Process data lines
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split('\t');
      if (values.length < 2) continue;
      
      // First column should be agent name (or date if state/segundos)
      let agentName = '';
      let dateFromRow = '';

      if (isStateExportFormat) {
        // columns: 0 fecha, 1 nombre, ... last = segundos
        dateFromRow = values[0].trim();
        agentName = values[1]
          .replace(/&nbsp;/g, ' ')
          .replace(/[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        agentName = values[0]
          .replace(/&nbsp;/g, ' ')
          .replace(/[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Skip if not a valid agent name
      if (!agentName || agentName.length < 3) continue;
      
      // Check if agent exists in team (or accept all if format looks right)
      const isTeamMember = teamMemberNames.includes(agentName);
      
      // Skip rows that look like headers or summaries
      if (!isStateExportFormat && (agentName.toLowerCase().includes('semana') || 
          agentName.toLowerCase().includes('nombre') ||
          agentName.toLowerCase().includes('total'))) {
        continue;
      }
      
      // If not in team members, try to find a partial match
      if (!isTeamMember) {
        const matchedMember = teamMemberNames.find(m => 
          m.toLowerCase().includes(agentName.toLowerCase()) || 
          agentName.toLowerCase().includes(m.toLowerCase())
        );
        if (matchedMember) {
          agentName = matchedMember;
        } else {
          continue; // Skip non-team members
        }
      }

      if (isStateExportFormat) {
        const estadoValue = (values[3] || '').toUpperCase();
        const isSumRow = estadoValue === 'SUM' || values.some(v => String(v || '').trim().toUpperCase() === 'SUM');

        // Parse date like "29 Dec 25" or similar (meses en inglés; se mantiene tolerancia)
        const dateStr = dateFromRow;
        const monthMap = {
          'jan':0,'ene':0,
          'feb':1,
          'mar':2,
          'apr':3,'abr':3,
          'may':4,
          'jun':5,
          'jul':6,
          'aug':7,'ago':7,
          'sep':8,'sept':8,
          'oct':9,
          'nov':10,
          'dec':11,'dic':11
        };
        let parsedDate = null;
        const parts = dateStr.trim().split(/\s+/);
        if (parts.length >= 3) {
          const day = parseInt(parts[0], 10);
          const monKey = (parts[1] || '').toLowerCase().substring(0,3);
          const monIdx = monthMap.hasOwnProperty(monKey) ? monthMap[monKey] : null;
          let year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          if (!isNaN(day) && monIdx !== null && !isNaN(year)) {
            parsedDate = new Date(year, monIdx, day, 0, 0, 0, 0);
          }
        }

        if (!parsedDate || isNaN(parsedDate.getTime())) continue;
        const yyyy = parsedDate.getFullYear();
        const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(parsedDate.getDate()).padStart(2, '0');
        const isoDate = `${yyyy}-${mm}-${dd}`;

        // Asegurar que la fecha cae en la semana seleccionada, día seleccionado o en el rango
        if (importMode === 'rango') {
          if (!rangeDateSet.has(isoDate)) continue;
        } else if (importMode === 'dia') {
          if (selectedDate !== isoDate) continue;
        } else {
          if (!weekDateSet.has(isoDate)) continue;
        }

        const findNumericDurationSeconds = (arr) => {
          // Busca el mayor número entero en la fila (común en exportes donde SUM deja duración en una columna)
          let best = null;
          arr.forEach(v => {
            const n = parseInt(String(v || '').replace(/,/g, '').trim(), 10);
            if (!isNaN(n) && n > 0) {
              if (best === null || n > best) best = n;
            }
          });
          return best;
        };

        const calcDurationSecondsFromTimes = (startStr, endStr) => {
          const s = String(startStr || '').trim();
          const e = String(endStr || '').trim();
          if (!/^\d{1,2}:\d{2}:\d{2}$/.test(s) || !/^\d{1,2}:\d{2}:\d{2}$/.test(e)) return 0;
          const toSec = (hms) => {
            const [hh, mm, ss] = hms.split(':').map(x => parseInt(x, 10) || 0);
            return hh * 3600 + mm * 60 + ss;
          };
          let ds = toSec(e) - toSec(s);
          if (ds < 0) ds += 24 * 3600; // cruce de medianoche
          return ds;
        };

        // 1) Preferir duración numérica si existe (especialmente en filas SUM)
        let seconds = findNumericDurationSeconds(values);

        // 2) Si no hay segundos numéricos, calcular desde hora inicio/fin (filas normales)
        if (!seconds || seconds <= 0) {
          const startTime = values[4];
          const endTime = values[5];
          seconds = calcDurationSecondsFromTimes(startTime, endTime);
        }

        if (!seconds || seconds <= 0) continue;

        if (!aggregatedSeconds[agentName]) aggregatedSeconds[agentName] = {};
        if (!sumSeenByAgentDate[agentName]) sumSeenByAgentDate[agentName] = {};
        if (isSumRow) {
          // Usar el total directo del día si viene en SUM (o lo calculamos si el export lo permite)
          aggregatedSeconds[agentName][isoDate] = seconds;
          sumSeenByAgentDate[agentName][isoDate] = true;
        } else {
          // Si existe SUM para el día, no seguir acumulando
          if (sumSeenByAgentDate[agentName][isoDate]) {
            continue;
          }
          aggregatedSeconds[agentName][isoDate] = (aggregatedSeconds[agentName][isoDate] || 0) + seconds;
        }
        continue;
      }

      if (importMode === 'dia') {
        const dayValueRaw = (values[1] || '').trim();
        if (!dayValueRaw) continue;
        const upper = dayValueRaw.toUpperCase();
        let status = 'worked';
        let hours = '';
        if (upper === 'LIBRE' || upper === '-') { status = 'libre'; hours = 'Libre'; }
        else if (upper === 'VACACIONES') { status = 'vacaciones'; hours = 'VACACIONES'; }
        else if (upper === 'CAMBIO') { status = 'cambio'; hours = 'CAMBIO'; }
        else if (upper === 'GUARDIA') { status = 'guardia'; hours = 'GUARDIA'; }
        else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(dayValueRaw)) {
          hours = dayValueRaw.split(':').length === 2 ? (dayValueRaw + ':00') : dayValueRaw;
        } else {
          continue; // valor no reconocido
        }
        const teamIdForAgent = (selectedTeam && selectedTeam !== 'all') ? selectedTeam : (nameToTeamId[agentName] || null);
        DataManager.saveAgentDailyHours(agentName, effectiveYear, monthIndex, weekIndex, selectedDate, { status, hours, team: teamIdForAgent });
        imported++;
      } else {
        // Semana completa
        const days = {};
        for (let j = 1; j <= Math.min(7, values.length - 1); j++) {
          const dayValue = values[j].trim();
          if (!dayValue) continue;
          const dateIndex = j - 1;
          if (dateIndex >= weekDates.length) break;
          const d = weekDates[dateIndex];
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          const upperValue = dayValue.toUpperCase();
          if (upperValue === 'LIBRE' || upperValue === '-') {
            days[dateStr] = { hours: 'Libre', status: 'libre' };
          } else if (upperValue === 'VACACIONES') {
            days[dateStr] = { hours: 'VACACIONES', status: 'vacaciones' };
          } else if (upperValue === 'CAMBIO') {
            days[dateStr] = { hours: 'CAMBIO', status: 'cambio' };
          } else if (upperValue === 'GUARDIA') {
            days[dateStr] = { hours: 'GUARDIA', status: 'guardia' };
          } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(dayValue)) {
            let hours = dayValue;
            if (dayValue.split(':').length === 2) {
              hours = dayValue + ':00';
            }
            days[dateStr] = { hours: hours, status: 'worked' };
          }
        }
        if (Object.keys(days).length > 0) {
          const teamIdForAgent = (selectedTeam && selectedTeam !== 'all') ? selectedTeam : (nameToTeamId[agentName] || null);
          agentData[agentName] = { days, reason: '', team: teamIdForAgent };
          imported++;
        }
      }
    }

    // Save acumulado desde formato export estado (guardado por día)
    if (isStateExportFormat) {
      Object.entries(aggregatedSeconds).forEach(([agentName, dates]) => {
        Object.entries(dates).forEach(([isoDate, totalSeconds]) => {
          const hours = this.secondsToHMS(totalSeconds);
          const teamIdForAgent = (selectedTeam && selectedTeam !== 'all') ? selectedTeam : (nameToTeamId[agentName] || null);
          if (importMode === 'rango') {
            const y = parseInt(isoDate.split('-')[0], 10);
            const m = parseInt(isoDate.split('-')[1], 10) - 1;
            const weeksForDate = DataManager.ensureWeekConfig(y, m) || [];
            const wIdx = weeksForDate.findIndex(w => w.startDate <= isoDate && isoDate <= w.endDate);
            if (wIdx !== -1) {
              DataManager.saveAgentDailyHours(agentName, y, m, wIdx, isoDate, { status: 'worked', hours, team: teamIdForAgent });
              imported++;
            }
          } else if (importMode === 'dia') {
            if (selectedDate === isoDate) {
              DataManager.saveAgentDailyHours(agentName, effectiveYear, monthIndex, weekIndex, isoDate, { status: 'worked', hours, team: teamIdForAgent });
              imported++;
            }
          } else {
            DataManager.saveAgentDailyHours(agentName, effectiveYear, monthIndex, weekIndex, isoDate, { status: 'worked', hours, team: teamIdForAgent });
            imported++;
          }
        });
      });
    }

    // Save the data para semana completa
    if (importMode === 'semana') {
      Object.entries(agentData).forEach(([agentName, data]) => {
        DataManager.saveAgentConnectionHours(agentName, effectiveYear, monthIndex, weekIndex, { ...data, team: data.team || ((selectedTeam && selectedTeam !== 'all') ? selectedTeam : (nameToTeamId[agentName] || null)) });
      });
    }

    this.closeConnectionHoursImportModal();
    
    if (imported > 0) {
      alert(`✅ Datos importados para ${imported} agente(s).`);
      this.loadConnectionHours();
    } else {
      alert('❌ No se pudo importar ningún dato. Verifique que:\n- Los agentes existan en el equipo seleccionado\n- El formato sea correcto (Nombre | Lunes | Martes | ... | Domingo)\n- Los datos estén separados por tabulaciones');
    }
  },

  loadConnectionHours() {
    const filterMonthConnectionHours = document.getElementById('filterMonthConnectionHours');
    const selectedMonth = filterMonthConnectionHours ? filterMonthConnectionHours.value : '';
    
    if (!selectedMonth) {
      const container = document.getElementById('connectionHoursContainer');
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-clock" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
          <p>Seleccione un mes para ver las horas de conexión</p>
        </div>
      `;
      return;
    }

    const parsed = this.parseSelectedMonthValue(selectedMonth);
    const month = parsed.monthIndex;
    const currentYear = parsed.yearOverride ?? this.getEffectiveYearForMonth(month);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = monthNames[month];

    // Get week configuration for this month
    let weeks = DataManager.getWeekConfig(currentYear, month);
    if (!weeks || !weeks.length) {
      weeks = DataManager.ensureWeekConfig(currentYear, month);
    }

    // Get connection hours data
    const connectionData = DataManager.getConnectionHoursData(currentYear, month);
    
    // Get teams and determine which to show
    const teams = DataManager.getAllTeams();
    const isEditor = DataManager.isEditor();
    const userTeam = DataManager.getUserTeam();
    const filterTeamConnectionHours = document.getElementById('filterTeamConnectionHours');
    const selectedTeamFilter = filterTeamConnectionHours ? filterTeamConnectionHours.value : '';

    // Determine which team to show
    let teamToShow = userTeam;
    if (isEditor && selectedTeamFilter) {
      teamToShow = selectedTeamFilter;
    }

    // If "Todos los Equipos" is selected (no team filter), render each team in its own section
    if (isEditor && !selectedTeamFilter && !userTeam) {
      const container = document.getElementById('connectionHoursContainer');
      
      // Get teams that have members
      const teamsWithMembers = Object.values(teams).filter(team => 
        team.members && team.members.some(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad')
      );
      
      if (teamsWithMembers.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
            <p>No hay equipos con integrantes registrados</p>
          </div>
        `;
        return;
      }
      
      let fullHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-primary);">
            <i class="fas fa-clock"></i> Horas de Conexión - ${monthName} ${currentYear} - Todos los Equipos
          </h3>
          <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">
            <strong>Regla:</strong> Turno normal = 8h/día, Madrugada = 6h/día
          </p>
        </div>
      `;
      
      // Render each team in its own section
      teamsWithMembers.forEach(team => {
        const teamAgentsList = team.members
          .filter(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad')
          .map(m => m.name)
          .sort((a, b) => {
            const shiftA = this.getAgentShift(a, teams);
            const shiftB = this.getAgentShift(b, teams);
            return this.getShiftPriority(shiftA) - this.getShiftPriority(shiftB);
          });
        
        if (teamAgentsList.length > 0) {
          fullHTML += this.renderConnectionHoursTableForTeam(team.name, team.color, teamAgentsList, weeks, connectionData, teams, currentYear, month, isEditor);
        }
      });
      
      container.innerHTML = fullHTML;
      return;
    }

    // Get agents list
    const allAgents = new Set();
    
    // Add team members
    if (teamToShow) {
      const team = teams[teamToShow];
      if (team && team.members) {
        team.members.forEach(member => {
          if (member.role !== 'supervisor' && member.role !== 'analista' && member.role !== 'calidad') {
            allAgents.add(member.name);
          }
        });
      }
    }

    // Also add agents that have data but might not be in team members list
    Object.keys(connectionData).forEach(agent => allAgents.add(agent));

    let agentsList = Array.from(allAgents).sort();

    // Filter by team
    if (teamToShow) {
      const team = teams[teamToShow];
      const teamMemberNames = team && team.members 
        ? team.members.filter(m => m.role !== 'supervisor' && m.role !== 'analista' && m.role !== 'calidad').map(m => m.name) 
        : [];
      agentsList = agentsList.filter(agent => teamMemberNames.includes(agent));
    }

    // Sort by shift
    agentsList.sort((a, b) => {
      const shiftA = this.getAgentShift(a, teams);
      const shiftB = this.getAgentShift(b, teams);
      return this.getShiftPriority(shiftA) - this.getShiftPriority(shiftB);
    });

    this.renderConnectionHoursTable(monthName, weeks, connectionData, agentsList, teams, currentYear, month, isEditor);
  },

  renderConnectionHoursTable(monthName, weeks, connectionData, agentsList, teams, year, month, isEditor) {
    const container = document.getElementById('connectionHoursContainer');
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const shortDayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    if (agentsList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
          <p>No hay agentes registrados para ${monthName}</p>
        </div>
      `;
      return;
    }

    // Helper to format seconds to H:MM:SS
    const formatTimeHMS = (seconds) => {
      if (!seconds || seconds <= 0) return '-';
      return this.formatSignedHMS(seconds);
    };

    // Helper to get dates for a week (Monday to Sunday)
    const getWeekDates = (startDate, endDate) => {
      const dates = [];
      const start = this.parseLocalDate(startDate);
      const end = this.parseLocalDate(endDate);
      const current = new Date(start);
      
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };

    // Build HTML for each week
    let fullHTML = '';
    
    weeks.forEach((week, weekIndex) => {
      const weekDates = getWeekDates(week.startDate, week.endDate);
      const startDay = week.startDate.split('-')[2];
      const startMonth = week.startDate.split('-')[1];
      const endDay = week.endDate.split('-')[2];
      const endMonth = week.endDate.split('-')[1];
      

      let tableHTML = `
        <div style="margin-bottom: 2rem; border: 1px solid #e5e7eb; border-radius: 0.75rem; overflow: visible;">
          <div style="background: linear-gradient(135deg, #272883, #1e1f6a); color: white; padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; font-size: 1rem; font-weight: 700;">
              <i class="fas fa-calendar-week"></i> Semana ${startDay}/${startMonth} al ${endDay}/${endMonth}
            </h4>
            <div style="font-size: 0.85rem; opacity: 0.9;">
              <span style="margin-right: 1rem;"><i class="fas fa-sun"></i> Normal: 8:00:00</span>
              <span><i class="fas fa-moon"></i> Madrugada: 6:00:00</span>
            </div>
          </div>
          
          <div class="table-scroll">
            <table class="data-table" style="font-size: 0.85rem; margin: 0;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="min-width: 150px; position: sticky; left: 0; background: #f8fafc; z-index: 1;">Nombre del Agente</th>
      `;
      
      // Add day headers with dates
      weekDates.forEach(date => {
        const dayName = shortDayNames[date.getDay()];
        const dayNum = String(date.getDate()).padStart(2, '0');
        const monthNum = String(date.getMonth() + 1).padStart(2, '0');
        tableHTML += `<th style="text-align: center; min-width: 80px;">${dayName}<br><small style="font-weight: 400; color: var(--text-muted);">${dayNum}/${monthNum}</small></th>`;
      });
      
      // Add summary headers (se elimina columna Evidencias)
      tableHTML += `
                  <th style="text-align: center; background: rgba(56, 206, 166, 0.1); min-width: 80px;">Días Rotación</th>
                  <th style="text-align: center; background: rgba(56, 206, 166, 0.1); min-width: 90px;">Horas Proyectadas</th>
                  <th style="text-align: center; background: rgba(56, 206, 166, 0.1); min-width: 90px;">Horas Realizadas</th>
                  <th style="text-align: center; background: rgba(239, 68, 68, 0.1); min-width: 80px;">Horas Pendientes</th>
                  <th style="text-align: center; background: rgba(16, 185, 129, 0.1); min-width: 80px;">Horas a Favor</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      // Add rows for each agent
      agentsList.forEach(agentName => {
        const agentShift = this.getAgentShift(agentName, teams);
        const expectedDailyHours = DataManager.getExpectedDailyHours(agentShift);
        const expectedDailySeconds = expectedDailyHours * 3600;

        const rotationDays = this.getAgentRotationDays(agentName, teams);
        
        const weekData = connectionData[agentName] && connectionData[agentName][weekIndex];
        const daysData = weekData && weekData.days ? weekData.days : {};
        const hasSavedWeekData = !!(weekData && weekData.days && Object.keys(weekData.days).length > 0);
        
        let requiredDays = 0;
        let ownWorkedSeconds = 0;
        
        // Selector de día por agente (compacto bajo el nombre)
        const sanitizedAgent = agentName.replace(/[^A-Za-z0-9_-]/g, '');
        const dayOptions = weekDates.map(date => {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          const iso = `${yyyy}-${mm}-${dd}`;
          const label = `${dd}/${mm}`;
          return `<option value="${iso}">${label}</option>`;
        }).join('');
        const agentControls = isEditor ? `
          <div style="margin-top: 4px; font-size: 0.8rem; opacity: 0.9; display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
            <select id="daySel-${weekIndex}-${sanitizedAgent}" class="input-dark" style="font-size: 0.75rem; padding: 2px 4px; max-width: 70px;">
              ${dayOptions}
            </select>
            <button type="button" class="btn-mini" style="padding: 2px 6px; background: rgba(39, 40, 131, 0.1); border: 1px solid rgba(39, 40, 131, 0.25);" onclick="App.openConnectionStatusModal('${agentName}', document.getElementById('daySel-${weekIndex}-${sanitizedAgent}').value)">Acción</button>
            <span title="Borrar Estado" style="cursor: pointer;" onclick="App.setConnectionDayStatus('${agentName}', document.getElementById('daySel-${weekIndex}-${sanitizedAgent}').value, 'clear')">🗑️</span>
          </div>
        ` : '';

        tableHTML += `<tr><td style="position: sticky; left: 0; background: white; z-index: 1;"><strong>${agentName}</strong>${agentControls}</td>`;
        
        // Add cell for each day
        weekDates.forEach(date => {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          const dayData = daysData[dateStr];
          
          let cellContent = '';
          let cellStyle = 'text-align: center;';
          const dow = date.getDay(); // 0=Domingo ... 6=Sábado
          const isInRotation = rotationDays.includes(dow);
          // Cambio de guardia ahora es manual: no se transfiere/acredita a otros
          
          if (!hasSavedWeekData && !dayData) {
            // Semana sin datos guardados: dejar celdas vacías
            tableHTML += `<td style="text-align: center; color: #9ca3af;">-</td>`;
            return;
          }

          if (dayData) {
            const status = dayData.status || 'worked';
            const hours = dayData.hours || '';
            
            if (status === 'libre' || hours === 'Libre') {
              cellContent = '<span style="color: #9ca3af; font-style: italic;">Libre</span>';
            } else if (status === 'vacaciones' || hours === 'VACACIONES') {
              cellContent = '<span style="color: #f59e0b; font-weight: 600;">VACACIONES</span>';
              cellStyle += ' background: rgba(245, 158, 11, 0.1);';
            } else if (status === 'cambio') {
              const seconds = DataManager.parseTimeToSeconds(hours);
              if (seconds > 0) {
                ownWorkedSeconds += seconds;
                cellContent = `<span style="color: #8b5cf6; font-weight: 700;">${hours}</span><div style="font-size: 0.7rem; color: #8b5cf6; font-weight: 600;">CAMBIO</div>`;
              } else {
                cellContent = `<span style="color: #8b5cf6; font-weight: 600;">CAMBIO</span>`;
              }
              cellStyle += ' background: rgba(139, 92, 246, 0.1);';
            } else if (status === 'guardia' || status === 'vacante' || hours === 'GUARDIA' || hours === 'VACANTE') {
              cellContent = '<span style="color: #06b6d4; font-weight: 600;">VACANTE</span>';
              cellStyle += ' background: rgba(6, 182, 212, 0.1);';
            } else if (hours) {
              // Parse hours and add to total
              const seconds = DataManager.parseTimeToSeconds(hours);
              if (seconds > 0) {
                ownWorkedSeconds += seconds;
              }
              if (seconds > 0) {
                if (seconds >= expectedDailySeconds) {
                  cellStyle += ' color: #10b981; font-weight: 600;';
                } else if (seconds >= expectedDailySeconds * 0.9) {
                  cellStyle += ' color: #f59e0b;';
                } else {
                  cellStyle += ' color: #ef4444;';
                }
              }
              cellContent = hours;
            }

            // Si hay un registro pero no hay contenido (sin horas/estado reconocido), aplicar reglas de rotación
            if (!cellContent) {
              if (!isInRotation) {
                cellContent = '<span style="color: #9ca3af; font-style: italic;">Libre</span>';
              } else {
                const vis = isEditor ? 'visible' : 'hidden';
                cellContent = `<span style="color: #ef4444; font-weight: 700; visibility: ${vis};">-${this.formatSignedHMS(expectedDailySeconds)}</span>`;
                cellStyle += ' background: rgba(239, 68, 68, 0.08);';
              }
            }
          } else {
            // Cuando ya existe data en la semana, aplican reglas de rotación
            if (!isInRotation) {
              cellContent = '<span style="color: #9ca3af; font-style: italic;">Libre</span>';
            } else {
              // FALTA: día obligatorio sin conexión
              const vis = isEditor ? 'visible' : 'hidden';
              cellContent = `<span style="color: #ef4444; font-weight: 700; visibility: ${vis};">-${this.formatSignedHMS(expectedDailySeconds)}</span>`;
              cellStyle += ' background: rgba(239, 68, 68, 0.08);';
            }
          }

          // Conteo de días obligatorios (rotación) considerando justificaciones
          if (isInRotation) {
            const status = dayData?.status;
            // Descanso/Vacaciones/Vacante/Cambio justifican y sacan el día del esperado
            if (status !== 'libre' && status !== 'vacaciones' && status !== 'vacante' && status !== 'guardia') {
              requiredDays += 1;
            }
          }
          
          tableHTML += `<td style="${cellStyle}">${cellContent}</td>`;
        });
        
        // Horas esperadas basadas en rotación (no en conexión detectada)
        const expectedSeconds = requiredDays * expectedDailySeconds;
        const actualSeconds = ownWorkedSeconds;
        const expectedFormatted = hasSavedWeekData ? formatTimeHMS(expectedSeconds) : '-';
        const actualFormatted = hasSavedWeekData ? formatTimeHMS(actualSeconds) : '-';
        
        // Calculate pending and extra hours
        const diff = actualSeconds - expectedSeconds;
        let pendingFormatted = '-';
        let extraFormatted = '-';
        
        if (!hasSavedWeekData) {
          pendingFormatted = '-';
          extraFormatted = '-';
        } else if (diff < 0) {
          pendingFormatted = `<span style="color: #ef4444; font-weight: 600;">${formatTimeHMS(Math.abs(diff))}</span>`;
        } else if (diff > 0) {
          extraFormatted = `<span style="color: #10b981; font-weight: 600;">${formatTimeHMS(diff)}</span>`;
        } else if (requiredDays > 0) {
          pendingFormatted = '0:00:00';
          extraFormatted = '0:00:00';
        }
        
        // Add summary cells (sin columna Evidencias)
        tableHTML += `
          <td style="text-align: center; background: rgba(56, 206, 166, 0.05); font-weight: 700;">${hasSavedWeekData ? requiredDays : '-'}</td>
          <td style="text-align: center; background: rgba(56, 206, 166, 0.05);">${expectedFormatted}</td>
          <td style="text-align: center; background: rgba(56, 206, 166, 0.05); font-weight: 600;">${actualFormatted}</td>
          <td style="text-align: center; background: rgba(239, 68, 68, 0.05);">${pendingFormatted}</td>
          <td style="text-align: center; background: rgba(16, 185, 129, 0.05);">${extraFormatted}</td>
        </tr>`;
      });
      
      tableHTML += `</tbody></table></div></div>`;
      fullHTML += tableHTML;
    });
    
    // Add header
    container.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-primary);">
          <i class="fas fa-clock"></i> Horas de Conexión - ${monthName} ${year}
        </h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">
          <strong>Regla:</strong> Turno normal = 8h/día, Madrugada = 6h/día
        </p>
      </div>
      ${fullHTML}
    `;
  },

  // Helper function to render connection hours table for a single team
  renderConnectionHoursTableForTeam(teamName, teamColor, agentsList, weeks, connectionData, teams, year, month, isEditor) {
    if (agentsList.length === 0) return '';
    
    const shortDayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    // Helper to format seconds to H:MM:SS
    const formatTimeHMS = (seconds) => {
      if (!seconds || seconds <= 0) return '-';
      return this.formatSignedHMS(seconds);
    };

    // Helper to get dates for a week
    const getWeekDates = (startDate, endDate) => {
      const dates = [];
      const start = this.parseLocalDate(startDate);
      const end = this.parseLocalDate(endDate);
      const current = new Date(start);
      
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };
    
    let teamHTML = `
      <div style="margin-bottom: 2rem; border: 2px solid ${teamColor}; border-radius: 0.75rem; overflow: visible;">
        <div style="background: ${teamColor}; color: white; padding: 0.75rem 1rem;">
          <h4 style="margin: 0; font-size: 1rem; font-weight: 700;">
            <i class="fas fa-users"></i> ${teamName}
          </h4>
        </div>
    `;
    
    // Build HTML for each week
    weeks.forEach((week, weekIndex) => {
      const weekDates = getWeekDates(week.startDate, week.endDate);

      const startDay = week.startDate.split('-')[2];
      const startMonth = week.startDate.split('-')[1];
      const endDay = week.endDate.split('-')[2];
      const endMonth = week.endDate.split('-')[1];
      
      teamHTML += `
        <div style="margin: 1rem; border: 1px solid #e5e7eb; border-radius: 0.75rem; overflow: visible;">
          <div style="background: linear-gradient(135deg, #272883, #1e1f6a); color: white; padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center;">
            <h5 style="margin: 0; font-size: 0.9rem; font-weight: 600;">
              <i class="fas fa-calendar-week"></i> Semana ${startDay}/${startMonth} al ${endDay}/${endMonth}
            </h5>
          </div>
          
          <div class="table-scroll">
            <table class="data-table" style="font-size: 0.85rem; margin: 0;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="min-width: 150px; position: sticky; left: 0; background: #f8fafc; z-index: 1;">Nombre del Agente</th>
      `;
      
      // Add day headers with dates
      weekDates.forEach(date => {
        const dayName = shortDayNames[date.getDay()];
        const dayNum = String(date.getDate()).padStart(2, '0');
        const monthNum = String(date.getMonth() + 1).padStart(2, '0');
        teamHTML += `<th style="text-align: center; min-width: 80px;">${dayName}<br><small style="font-weight: 400; color: var(--text-muted);">${dayNum}/${monthNum}</small></th>`;
      });
      
      // Add summary headers
      teamHTML += `
                  <th style="text-align: center; background: rgba(56, 206, 166, 0.1); min-width: 80px;">Días Rotación</th>
                  <th style="text-align: center; background: rgba(56, 206, 166, 0.1); min-width: 90px;">Horas Proyectadas</th>
                  <th style="text-align: center; background: rgba(56, 206, 166, 0.1); min-width: 90px;">Horas Realizadas</th>
                  <th style="text-align: center; background: rgba(239, 68, 68, 0.1); min-width: 80px;">Horas Pendientes</th>
                  <th style="text-align: center; background: rgba(16, 185, 129, 0.1); min-width: 80px;">Horas a Favor</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      // Add rows for each agent
      agentsList.forEach(agentName => {
        const agentShift = this.getAgentShift(agentName, teams);
        const expectedDailyHours = DataManager.getExpectedDailyHours(agentShift);
        const expectedDailySeconds = expectedDailyHours * 3600;

        const rotationDays = this.getAgentRotationDays(agentName, teams);
        
        const weekData = connectionData[agentName] && connectionData[agentName][weekIndex];
        const daysData = weekData && weekData.days ? weekData.days : {};
        const hasSavedWeekData = !!(weekData && weekData.days && Object.keys(weekData.days).length > 0);
        
        let requiredDays = 0;
        let ownWorkedSeconds = 0;
        
        // Control buttons for editors
        const sanitizedAgent = agentName.replace(/[^A-Za-z0-9_-]/g, '');
        const dayOptions = weekDates.map(date => {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          const iso = `${yyyy}-${mm}-${dd}`;
          const label = `${dd}/${mm}`;
          return `<option value="${iso}">${label}</option>`;
        }).join('');
        const agentControls = isEditor ? `
          <div style="margin-top: 4px; font-size: 0.8rem; opacity: 0.9; display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
            <select id="daySelTeam-${weekIndex}-${sanitizedAgent}" class="input-dark" style="font-size: 0.75rem; padding: 2px 4px; max-width: 70px;">
              ${dayOptions}
            </select>
            <button type="button" class="btn-mini" style="padding: 2px 6px; background: rgba(39, 40, 131, 0.1); border: 1px solid rgba(39, 40, 131, 0.25);" onclick="App.openConnectionStatusModal('${agentName}', document.getElementById('daySelTeam-${weekIndex}-${sanitizedAgent}').value)">Acción</button>
            <span title="Borrar Estado" style="cursor: pointer;" onclick="App.setConnectionDayStatus('${agentName}', document.getElementById('daySelTeam-${weekIndex}-${sanitizedAgent}').value, 'clear')">🗑️</span>
          </div>
        ` : '';
        
        teamHTML += `<tr><td style="position: sticky; left: 0; background: white; z-index: 1;"><strong>${agentName}</strong>${agentControls}</td>`;
        
        // Add cell for each day
        weekDates.forEach(date => {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          const dayData = daysData[dateStr];
          
          let cellContent = '';
          let cellStyle = 'text-align: center;';
          const dow = date.getDay();
          const isInRotation = rotationDays.includes(dow);
          
          if (!hasSavedWeekData && !dayData) {
            teamHTML += `<td style="text-align: center; color: #9ca3af;">-</td>`;
            return;
          }

          if (dayData) {
            const status = dayData.status || 'worked';
            const hours = dayData.hours || '';
            
            if (status === 'libre' || hours === 'Libre') {
              cellContent = '<span style="color: #9ca3af; font-style: italic;">Libre</span>';
            } else if (status === 'vacaciones' || hours === 'VACACIONES') {
              cellContent = '<span style="color: #f59e0b; font-weight: 600;">VACACIONES</span>';
              cellStyle += ' background: rgba(245, 158, 11, 0.1);';
            } else if (status === 'cambio') {
              const seconds = DataManager.parseTimeToSeconds(hours);
              if (seconds > 0) {
                ownWorkedSeconds += seconds;
                cellContent = `<span style="color: #8b5cf6; font-weight: 700;">${hours}</span><div style="font-size: 0.7rem; color: #8b5cf6; font-weight: 600;">CAMBIO</div>`;
              } else {
                cellContent = `<span style="color: #8b5cf6; font-weight: 600;">CAMBIO</span>`;
              }
              cellStyle += ' background: rgba(139, 92, 246, 0.1);';
            } else if (status === 'guardia' || status === 'vacante' || hours === 'GUARDIA' || hours === 'VACANTE') {
              cellContent = '<span style="color: #06b6d4; font-weight: 600;">VACANTE</span>';
              cellStyle += ' background: rgba(6, 182, 212, 0.1);';
            } else if (hours) {
              const seconds = DataManager.parseTimeToSeconds(hours);
              if (seconds > 0) {
                ownWorkedSeconds += seconds;
              }
              if (seconds > 0) {
                if (seconds >= expectedDailySeconds) {
                  cellStyle += ' color: #10b981; font-weight: 600;';
                } else if (seconds >= expectedDailySeconds * 0.9) {
                  cellStyle += ' color: #f59e0b;';
                } else {
                  cellStyle += ' color: #ef4444;';
                }
              }
              cellContent = hours;
            }

            if (!cellContent) {
              if (!isInRotation) {
                cellContent = '<span style="color: #9ca3af; font-style: italic;">Libre</span>';
              } else {
                const vis = isEditor ? 'visible' : 'hidden';
                cellContent = `<span style="color: #ef4444; font-weight: 700; visibility: ${vis};">-${this.formatSignedHMS(expectedDailySeconds)}</span>`;
                cellStyle += ' background: rgba(239, 68, 68, 0.08);';
              }
            }
          } else {
            if (!isInRotation) {
              cellContent = '<span style="color: #9ca3af; font-style: italic;">Libre</span>';
            } else {
              const vis = isEditor ? 'visible' : 'hidden';
              cellContent = `<span style="color: #ef4444; font-weight: 700; visibility: ${vis};">-${this.formatSignedHMS(expectedDailySeconds)}</span>`;
              cellStyle += ' background: rgba(239, 68, 68, 0.08);';
            }
          }

          // Conteo de días obligatorios según rotación
          if (isInRotation) {
            const status = dayData?.status;
            if (status !== 'libre' && status !== 'vacaciones' && status !== 'vacante' && status !== 'guardia') {
              requiredDays += 1;
            }
          }
          
          teamHTML += `<td style="${cellStyle}">${cellContent}</td>`;
        });
        
        const expectedSeconds = requiredDays * expectedDailySeconds;
        const actualSeconds = ownWorkedSeconds;
        const expectedFormatted = hasSavedWeekData ? formatTimeHMS(expectedSeconds) : '-';
        const actualFormatted = hasSavedWeekData ? formatTimeHMS(actualSeconds) : '-';
        
        // Calculate pending and extra hours
        const diff = actualSeconds - expectedSeconds;
        let pendingFormatted = '-';
        let extraFormatted = '-';
        
        if (!hasSavedWeekData) {
          pendingFormatted = '-';
          extraFormatted = '-';
        } else if (diff < 0) {
          pendingFormatted = `<span style="color: #ef4444; font-weight: 600;">${formatTimeHMS(Math.abs(diff))}</span>`;
        } else if (diff > 0) {
          extraFormatted = `<span style="color: #10b981; font-weight: 600;">${formatTimeHMS(diff)}</span>`;
        } else if (requiredDays > 0) {
          pendingFormatted = '0:00:00';
          extraFormatted = '0:00:00';
        }
        
        teamHTML += `
          <td style="text-align: center; background: rgba(56, 206, 166, 0.05); font-weight: 700;">${hasSavedWeekData ? requiredDays : '-'}</td>
          <td style="text-align: center; background: rgba(56, 206, 166, 0.05);">${expectedFormatted}</td>
          <td style="text-align: center; background: rgba(56, 206, 166, 0.05); font-weight: 600;">${actualFormatted}</td>
          <td style="text-align: center; background: rgba(239, 68, 68, 0.05);">${pendingFormatted}</td>
          <td style="text-align: center; background: rgba(16, 185, 129, 0.05);">${extraFormatted}</td>
        </tr>`;
      });
      
      teamHTML += `</tbody></table></div></div>`;
    });
    
    teamHTML += `</div>`;
    
    return teamHTML;
  },

  showAgentEvidence(agentName, year, month, weekIndex) {
    // Show evidence modal or link to Zendesk data
    alert(`Evidencias de ${agentName} para la semana ${weekIndex + 1}`);
  },

  updateConnectionReason(input) {
    const agentName = input.dataset.agent;
    const year = parseInt(input.dataset.year);
    const month = parseInt(input.dataset.month);
    const reason = input.value.trim();

    // Save reason to the first week that has data, or week 0 if none
    const connectionData = DataManager.getConnectionHoursData(year, month);
    if (connectionData[agentName]) {
      const weekIndexes = Object.keys(connectionData[agentName]);
      if (weekIndexes.length > 0) {
        DataManager.updateConnectionHoursReason(agentName, year, month, parseInt(weekIndexes[0]), reason);
      }
    } else {
      // Create an entry for week 0 with the reason
      DataManager.saveAgentConnectionHours(agentName, year, month, 0, {
        totalSeconds: 0,
        entries: [],
        reason: reason
      });
    }
  },

  // Statistics Section Functions
  initializeStatisticsFilters() {
    const teams = DataManager.getAllTeams();
    const userTeam = DataManager.getUserTeam();
    const isEditor = DataManager.isEditor();
    const hasSupervisorPerms = DataManager.hasSupervisorPermissions();

    // Populate team filter
    const filterTeamStats = document.getElementById('filterTeamStats');
    if (filterTeamStats) {
      // Clear existing options except the first one
      while (filterTeamStats.options.length > 1) {
        filterTeamStats.remove(1);
      }

      Object.values(teams).forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        filterTeamStats.appendChild(option);
      });

      // For non-editor users, restrict to their team
      if (!isEditor && !hasSupervisorPerms && userTeam) {
        filterTeamStats.value = userTeam;
        filterTeamStats.disabled = true;
      } else if (hasSupervisorPerms && userTeam) {
        filterTeamStats.value = userTeam;
        filterTeamStats.disabled = false;
      } else {
        filterTeamStats.disabled = false;
      }
    }

    // Initialize agent filter with empty state
    this.updateAgentStatsFilter();
  },

  // Update agent filter based on selected team
  updateAgentStatsFilter() {
    const filterTeamStats = document.getElementById('filterTeamStats');
    const filterAgentStats = document.getElementById('filterAgentStats');
    const selectedTeam = filterTeamStats ? filterTeamStats.value : '';

    if (!filterAgentStats) return;

    // Clear existing options except the first one
    while (filterAgentStats.options.length > 1) {
      filterAgentStats.remove(1);
    }

    const teams = DataManager.getAllTeams();
    let agents = [];

    if (selectedTeam && teams[selectedTeam] && teams[selectedTeam].members) {
      // Get agents from the selected team
      agents = teams[selectedTeam].members.map(m => m.name).sort();
    } else {
      // Get all agents from all teams
      Object.values(teams).forEach(team => {
        if (team.members) {
          team.members.forEach(m => {
            if (!agents.includes(m.name)) {
              agents.push(m.name);
            }
          });
        }
      });
      agents.sort();
    }

    agents.forEach(agentName => {
      const option = document.createElement('option');
      option.value = agentName;
      option.textContent = agentName;
      filterAgentStats.appendChild(option);
    });
  },

  loadStatistics() {
    const filterMonthStats = document.getElementById('filterMonthStats');
    const selectedMonth = filterMonthStats ? filterMonthStats.value : '';

    if (!selectedMonth) {
      const container = document.getElementById('statisticsContainer');
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-chart-pie" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
          <p>Seleccione un mes para ver las estadísticas de auditorías</p>
        </div>
      `;
      return;
    }

    const parsed = this.parseSelectedMonthValue(selectedMonth);
    const monthIndex = parsed.monthIndex;
    const year = parsed.yearOverride ?? this.getEffectiveYearForMonth(monthIndex);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = monthNames[monthIndex];

    const filterTeamStats = document.getElementById('filterTeamStats');
    const selectedTeam = filterTeamStats ? filterTeamStats.value : '';
    
    const filterAgentStats = document.getElementById('filterAgentStats');
    const selectedAgent = filterAgentStats ? filterAgentStats.value : '';

    let stats;
    let teamName = 'Todos los Equipos';
    let displayName = '';
    const teams = DataManager.getAllTeams();

    // Get audits based on filters
    let audits;
    if (selectedTeam) {
      audits = DataManager.getAuditsForStatistics(year, monthIndex, selectedTeam);
      teamName = teams[selectedTeam] ? teams[selectedTeam].name : selectedTeam;
    } else {
      audits = DataManager.getAuditsForStatistics(year, monthIndex, null);
    }

    // Filter by specific agent if selected
    if (selectedAgent) {
      audits = audits.filter(a => a.agentName === selectedAgent);
      displayName = `${selectedAgent} - ${teamName}`;
    } else {
      displayName = teamName;
    }

    stats = DataManager.calculateAuditStatistics(audits);

    this.renderStatistics(stats, monthName, year, displayName, selectedTeam, selectedAgent);
  },

  renderStatistics(stats, monthName, year, teamName, teamId, selectedAgent) {
    const container = document.getElementById('statisticsContainer');
    const teams = DataManager.getAllTeams();

    if (!stats || stats.totalAudits === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
          <p>No hay auditorías registradas para ${monthName} ${year} en ${teamName}</p>
        </div>
      `;
      return;
    }

    // Build the statistics HTML
    let html = `
      <div style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--text-primary);">
          <i class="fas fa-chart-pie"></i> Estadísticas - ${monthName} ${year} - ${teamName}
        </h3>
      </div>

      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: linear-gradient(135deg, #38CEA6, #0b8f6a); color: white; padding: 1.25rem; border-radius: 0.75rem;">
          <div style="font-size: 0.85rem; opacity: 0.9;">Total Auditorías</div>
          <div style="font-size: 2rem; font-weight: 700;">${stats.totalAudits}</div>
        </div>
        <div style="background: linear-gradient(135deg, #272883, #1e1f6a); color: white; padding: 1.25rem; border-radius: 0.75rem;">
          <div style="font-size: 0.85rem; opacity: 0.9;">Promedio de Calidad</div>
          <div style="font-size: 2rem; font-weight: 700;">${stats.averageScore}%</div>
        </div>
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 1.25rem; border-radius: 0.75rem;">
          <div style="font-size: 0.85rem; opacity: 0.9;">Auditorías c/Fallo Empatía</div>
          <div style="font-size: 2rem; font-weight: 700;">${stats.pillarDeficiencies.empatia}</div>
          <div style="font-size: 0.75rem; opacity: 0.8;">${Math.round((stats.pillarDeficiencies.empatia / stats.totalAudits) * 100)}% del total</div>
        </div>
        <div style="background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; padding: 1.25rem; border-radius: 0.75rem;">
          <div style="font-size: 0.85rem; opacity: 0.9;">Auditorías c/Fallo Gestión</div>
          <div style="font-size: 2rem; font-weight: 700;">${stats.pillarDeficiencies.gestion}</div>
          <div style="font-size: 0.75rem; opacity: 0.8;">${Math.round((stats.pillarDeficiencies.gestion / stats.totalAudits) * 100)}% del total</div>
        </div>
      </div>

      <!-- Score Distribution -->
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem; margin-bottom: 1.5rem;">
        <h4 style="font-size: 1rem; font-weight: 700; margin: 0 0 1rem 0; color: var(--text-primary);">
          <i class="fas fa-chart-bar" style="color: #38CEA6;"></i> Distribución de Puntajes
        </h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;">
          <div style="text-align: center; padding: 0.75rem; background: #dcfce7; border-radius: 0.5rem;">
            <div style="font-size: 1.5rem; font-weight: 700; color: #16a34a;">${stats.scoreDistribution.excellent}</div>
            <div style="font-size: 0.8rem; color: #166534;">Excelente (95%+)</div>
            <div style="font-size: 0.75rem; color: #6b7280;">${Math.round((stats.scoreDistribution.excellent / stats.totalAudits) * 100)}%</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: #dbeafe; border-radius: 0.5rem;">
            <div style="font-size: 1.5rem; font-weight: 700; color: #2563eb;">${stats.scoreDistribution.good}</div>
            <div style="font-size: 0.8rem; color: #1e40af;">Bueno (80-94%)</div>
            <div style="font-size: 0.75rem; color: #6b7280;">${Math.round((stats.scoreDistribution.good / stats.totalAudits) * 100)}%</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: #fef3c7; border-radius: 0.5rem;">
            <div style="font-size: 1.5rem; font-weight: 700; color: #d97706;">${stats.scoreDistribution.regular}</div>
            <div style="font-size: 0.8rem; color: #92400e;">Regular (60-79%)</div>
            <div style="font-size: 0.75rem; color: #6b7280;">${Math.round((stats.scoreDistribution.regular / stats.totalAudits) * 100)}%</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: #fee2e2; border-radius: 0.5rem;">
            <div style="font-size: 1.5rem; font-weight: 700; color: #dc2626;">${stats.scoreDistribution.poor}</div>
            <div style="font-size: 0.8rem; color: #991b1b;">Deficiente (<60%)</div>
            <div style="font-size: 0.75rem; color: #6b7280;">${Math.round((stats.scoreDistribution.poor / stats.totalAudits) * 100)}%</div>
          </div>
        </div>
      </div>

      <!-- Top Deficient Criteria -->
      <div style="background: #fef3f2; border: 1px solid #fecaca; border-radius: 0.75rem; padding: 1.25rem; margin-bottom: 1.5rem;">
        <h4 style="font-size: 1rem; font-weight: 700; margin: 0 0 1rem 0; color: #b91c1c;">
          <i class="fas fa-exclamation-triangle"></i> Principales Deficiencias por Criterio
        </h4>
        ${stats.topDeficientCriteria.length > 0 ? `
          <div class="table-scroll">
            <table class="data-table" style="font-size: 0.85rem; margin: 0;">
              <thead>
                <tr style="background: #fff5f5;">
                  <th>Criterio</th>
                  <th>Categoría</th>
                  <th>Fallos</th>
                  <th>% de Auditorías</th>
                  <th>Agentes Afectados</th>
                </tr>
              </thead>
              <tbody>
                ${stats.topDeficientCriteria.map(criterion => `
                  <tr>
                    <td><strong>${criterion.name}</strong></td>
                    <td><span style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; background: ${criterion.category === 'empatia' ? '#dcfce7' : '#dbeafe'}; color: ${criterion.category === 'empatia' ? '#166534' : '#1e40af'};">${this.formatCategoryName(criterion.category)}</span></td>
                    <td style="text-align: center; font-weight: 600; color: #dc2626;">${criterion.count}</td>
                    <td style="text-align: center;">
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="flex: 1; height: 8px; background: #fee2e2; border-radius: 4px; overflow: hidden;">
                          <div style="width: ${criterion.percentage}%; height: 100%; background: #ef4444;"></div>
                        </div>
                        <span style="font-weight: 600; color: #dc2626;">${criterion.percentage}%</span>
                      </div>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">${criterion.agents.slice(0, 3).join(', ')}${criterion.agents.length > 3 ? ` (+${criterion.agents.length - 3} más)` : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p style="color: var(--text-muted); text-align: center;">No hay deficiencias registradas</p>'}
      </div>
    `;

    // Agents with Pillar Issues
    html += `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <!-- Empatía Issues -->
        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 0.75rem; padding: 1.25rem;">
          <h4 style="font-size: 1rem; font-weight: 700; margin: 0 0 1rem 0; color: #92400e;">
            <i class="fas fa-heart" style="color: #f59e0b;"></i> Agentes con Deficiencias en Empatía
          </h4>
          ${stats.agentsByPillarIssue.empatia.length > 0 ? `
            <div style="display: grid; gap: 0.5rem;">
              ${stats.agentsByPillarIssue.empatia.slice(0, 5).map(agent => `
                <div style="background: white; padding: 0.75rem; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong>${agent.name}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${agent.issueCount}/${agent.totalAudits} auditorías con fallos</div>
                  </div>
                  <span style="padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-weight: 700; font-size: 0.9rem; background: #fef3c7; color: #92400e;">${agent.issueRate}%</span>
                </div>
              `).join('')}
            </div>
            ${stats.agentsByPillarIssue.empatia.length > 5 ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">+${stats.agentsByPillarIssue.empatia.length - 5} agentes más</p>` : ''}
          ` : '<p style="color: var(--text-muted); text-align: center;">No hay agentes con deficiencias significativas en empatía</p>'}
        </div>

        <!-- Gestión Issues -->
        <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 0.75rem; padding: 1.25rem;">
          <h4 style="font-size: 1rem; font-weight: 700; margin: 0 0 1rem 0; color: #991b1b;">
            <i class="fas fa-cogs" style="color: #ef4444;"></i> Agentes con Deficiencias en Gestión
          </h4>
          ${stats.agentsByPillarIssue.gestion.length > 0 ? `
            <div style="display: grid; gap: 0.5rem;">
              ${stats.agentsByPillarIssue.gestion.slice(0, 5).map(agent => `
                <div style="background: white; padding: 0.75rem; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong>${agent.name}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${agent.issueCount}/${agent.totalAudits} auditorías con fallos</div>
                  </div>
                  <span style="padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-weight: 700; font-size: 0.9rem; background: #fee2e2; color: #991b1b;">${agent.issueRate}%</span>
                </div>
              `).join('')}
            </div>
            ${stats.agentsByPillarIssue.gestion.length > 5 ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">+${stats.agentsByPillarIssue.gestion.length - 5} agentes más</p>` : ''}
          ` : '<p style="color: var(--text-muted); text-align: center;">No hay agentes con deficiencias significativas en gestión</p>'}
        </div>
      </div>
    `;

    // Agent Rankings
    html += `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.75rem; padding: 1.25rem; margin-bottom: 1.5rem;">
        <h4 style="font-size: 1rem; font-weight: 700; margin: 0 0 1rem 0; color: #166534;">
          <i class="fas fa-trophy" style="color: #22c55e;"></i> Ranking de Agentes
        </h4>
        ${stats.agentRankings.length > 0 ? `
          <div class="table-scroll">
            <table class="data-table" style="font-size: 0.85rem; margin: 0;">
              <thead>
                <tr style="background: #f0fdf4;">
                  <th style="width: 50px;">#</th>
                  <th>Agente</th>
                  <th style="text-align: center;">Auditorías</th>
                  <th style="text-align: center;">Prom. Calidad</th>
                  <th style="text-align: center;">% Fallos Empatía</th>
                  <th style="text-align: center;">% Fallos Gestión</th>
                </tr>
              </thead>
              <tbody>
                ${stats.agentRankings.slice(0, 15).map((agent, index) => `
                  <tr>
                    <td style="text-align: center; font-weight: 700; color: ${index < 3 ? '#f59e0b' : 'var(--text-muted)'};">
                      ${index < 3 ? ['🥇', '🥈', '🥉'][index] : (index + 1)}
                    </td>
                    <td><strong>${agent.name}</strong></td>
                    <td style="text-align: center;">${agent.totalAudits}</td>
                    <td style="text-align: center; font-weight: 600; color: ${agent.averageScore >= 90 ? '#16a34a' : agent.averageScore >= 80 ? '#0ea5e9' : agent.averageScore >= 60 ? '#d97706' : '#dc2626'};">${agent.averageScore}%</td>
                    <td style="text-align: center;">
                      <span style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.8rem; background: ${agent.empatiaIssueRate === 0 ? '#dcfce7' : '#fef3c7'}; color: ${agent.empatiaIssueRate === 0 ? '#16a34a' : '#d97706'};">${agent.empatiaIssueRate}%</span>
                    </td>
                    <td style="text-align: center;">
                      <span style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.8rem; background: ${agent.gestionIssueRate === 0 ? '#dcfce7' : '#fee2e2'}; color: ${agent.gestionIssueRate === 0 ? '#16a34a' : '#dc2626'};">${agent.gestionIssueRate}%</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${stats.agentRankings.length > 15 ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; text-align: center;">Mostrando top 15 de ${stats.agentRankings.length} agentes</p>` : ''}
        ` : '<p style="color: var(--text-muted); text-align: center;">No hay datos de agentes disponibles</p>'}
      </div>
    `;

    // Detailed Criteria Analysis (Expandable)
    html += `
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem;">
        <h4 style="font-size: 1rem; font-weight: 700; margin: 0 0 1rem 0; color: var(--text-primary);">
          <i class="fas fa-clipboard-list" style="color: #6366f1;"></i> Análisis Detallado por Criterio
        </h4>
        
        <!-- Empatía Criteria -->
        <div style="margin-bottom: 1rem;">
          <h5 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #38CEA6; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-heart"></i> Pilar Empatía (50%)
          </h5>
          <div style="display: grid; gap: 0.5rem;">
            ${DataManager.AUDIT_CRITERIA.empatia.map(criterion => {
              const deficiency = stats.criteriaDeficiencies[criterion.id] || { count: 0, percentage: 0 };
              return `
                <div style="background: white; padding: 0.75rem; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid ${deficiency.percentage >= 30 ? '#ef4444' : deficiency.percentage >= 15 ? '#f59e0b' : '#38CEA6'};">
                  <div>
                    <strong style="font-size: 0.85rem;">${criterion.name}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${criterion.description}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-weight: 700; color: ${deficiency.percentage >= 30 ? '#dc2626' : deficiency.percentage >= 15 ? '#d97706' : '#16a34a'};">${deficiency.percentage}%</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${deficiency.count} fallos</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Gestión Criteria -->
        <div>
          <h5 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #f59e0b; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-cogs"></i> Pilar Gestión (50%)
          </h5>
          
          <!-- Gestión de Ticket -->
          <div style="margin-bottom: 0.75rem;">
            <h6 style="font-size: 0.85rem; font-weight: 600; margin: 0 0 0.5rem 0; color: var(--text-primary);">Gestión de Ticket (33%)</h6>
            <div style="display: grid; gap: 0.5rem;">
              ${DataManager.AUDIT_CRITERIA.gestion.ticket.map(criterion => {
                const deficiency = stats.criteriaDeficiencies[criterion.id] || { count: 0, percentage: 0 };
                return `
                  <div style="background: white; padding: 0.75rem; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid ${deficiency.percentage >= 30 ? '#ef4444' : deficiency.percentage >= 15 ? '#f59e0b' : '#f59e0b33'};">
                    <div>
                      <strong style="font-size: 0.85rem;">${criterion.name}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${criterion.description}</div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-weight: 700; color: ${deficiency.percentage >= 30 ? '#dc2626' : deficiency.percentage >= 15 ? '#d97706' : '#16a34a'};">${deficiency.percentage}%</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${deficiency.count} fallos</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Conocimiento Integral -->
          <div style="margin-bottom: 0.75rem;">
            <h6 style="font-size: 0.85rem; font-weight: 600; margin: 0 0 0.5rem 0; color: var(--text-primary);">Conocimiento Integral (33%)</h6>
            <div style="display: grid; gap: 0.5rem;">
              ${DataManager.AUDIT_CRITERIA.gestion.conocimiento.map(criterion => {
                const deficiency = stats.criteriaDeficiencies[criterion.id] || { count: 0, percentage: 0 };
                return `
                  <div style="background: white; padding: 0.75rem; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid ${deficiency.percentage >= 30 ? '#ef4444' : deficiency.percentage >= 15 ? '#f59e0b' : '#f59e0b33'};">
                    <div>
                      <strong style="font-size: 0.85rem;">${criterion.name}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${criterion.description}</div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-weight: 700; color: ${deficiency.percentage >= 30 ? '#dc2626' : deficiency.percentage >= 15 ? '#d97706' : '#16a34a'};">${deficiency.percentage}%</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${deficiency.count} fallos</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Herramientas -->
          <div>
            <h6 style="font-size: 0.85rem; font-weight: 600; margin: 0 0 0.5rem 0; color: var(--text-primary);">Uso Estratégico de Herramientas (33%)</h6>
            <div style="display: grid; gap: 0.5rem;">
              ${DataManager.AUDIT_CRITERIA.gestion.herramientas.map(criterion => {
                const deficiency = stats.criteriaDeficiencies[criterion.id] || { count: 0, percentage: 0 };
                return `
                  <div style="background: white; padding: 0.75rem; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid ${deficiency.percentage >= 30 ? '#ef4444' : deficiency.percentage >= 15 ? '#f59e0b' : '#f59e0b33'};">
                    <div>
                      <strong style="font-size: 0.85rem;">${criterion.name}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${criterion.description}</div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-weight: 700; color: ${deficiency.percentage >= 30 ? '#dc2626' : deficiency.percentage >= 15 ? '#d97706' : '#16a34a'};">${deficiency.percentage}%</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${deficiency.count} fallos</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  formatCategoryName(category) {
    const names = {
      'empatia': 'Empatía',
      'gestion-ticket': 'Gestión Ticket',
      'gestion-conocimiento': 'Conocimiento',
      'gestion-herramientas': 'Herramientas'
    };
    return names[category] || category;
  }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
