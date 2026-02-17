/* ==================================================== */
/* EVENTS MODULE */
/* ==================================================== */

const eventsModule = {
  /**
   * Load all events from database
   */
  async loadEvents() {
    try {
      utils.showLoading();
      utils.showTableLoading('eventsTableBody', 8);

      const { data, error } = await STATE.client
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;

      STATE.allEvents = data || [];
      this.renderEvents();

      console.log(`✅ Loaded ${STATE.allEvents.length} events`);

    } catch (error) {
      console.error('Error loading events:', error);
      utils.showToast('Failed to load events: ' + error.message, 'error');
      utils.showEmptyState('eventsTableBody', 8, 'Failed to load events', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Render events table
   */
  renderEvents() {
    this.updateEventStats();
    const events = STATE.allEvents || [];
    const count = document.getElementById('eventsCount');
    if (count) count.textContent = events.length;

    if (events.length === 0) {
      utils.showEmptyState('eventsTableBody', 8, 'No events found. Click "Add Event" to create one.');
      return;
    }

    this.renderFilteredEvents(events);
  },

  /**
   * Open add event modal
   */
  openAddModal() {
    document.getElementById('eventModalTitle').textContent = 'Add Event';
    document.getElementById('eventId').value = '';
    document.getElementById('eventName').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventYear').value = '';
    document.getElementById('eventVenue').value = '';
    document.getElementById('eventCapacity').value = '';
    document.getElementById('eventDescription').value = '';
    document.getElementById('eventStatus').value = 'draft';
    document.getElementById('saveEventBtn').textContent = 'Add Event';

    const modal = new bootstrap.Modal(document.getElementById('eventModal'));
    modal.show();
  },

  /**
   * Open edit event modal
   */
  async openEditModal(eventId) {
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    document.getElementById('eventModalTitle').textContent = 'Edit Event';
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventName').value = event.event_name || '';
    document.getElementById('eventDate').value = event.event_date || '';
    document.getElementById('eventYear').value = event.year || '';
    document.getElementById('eventVenue').value = event.venue || '';
    document.getElementById('eventCapacity').value = event.capacity || '';
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventStatus').value = event.event_status || 'draft';
    document.getElementById('saveEventBtn').textContent = 'Update Event';

    const modal = new bootstrap.Modal(document.getElementById('eventModal'));
    modal.show();
  },

  /**
   * Save event (add or update)
   */
  async saveEvent() {
    const eventId = document.getElementById('eventId').value;
    const eventName = document.getElementById('eventName').value.trim();
    const eventDate = document.getElementById('eventDate').value;
    const eventYear = document.getElementById('eventYear').value;
    const eventVenue = document.getElementById('eventVenue').value.trim();
    const eventCapacity = document.getElementById('eventCapacity').value;
    const eventDescription = document.getElementById('eventDescription').value.trim();

    if (!eventName) {
      utils.showToast('Please enter an event name', 'warning');
      return;
    }

    try {
      utils.showLoading();

      const eventStatus = document.getElementById('eventStatus').value;

      const eventData = {
        event_name: eventName,
        event_date: eventDate || null,
        year: eventYear ? parseInt(eventYear) : null,
        venue: eventVenue || null,
        capacity: eventCapacity ? parseInt(eventCapacity) : null,
        description: eventDescription || null,
        event_status: eventStatus || 'draft'
      };

      let error;

      if (eventId) {
        // Update existing event
        ({ error } = await STATE.client
          .from('events')
          .update(eventData)
          .eq('id', eventId));

        if (error) throw error;

      } else {
        // Insert new event
        const { data: newEvent, error: insertError } = await STATE.client
          .from('events')
          .insert([eventData])
          .select()
          .single();

        if (insertError) throw insertError;

        // Create gallery sections from template if available
        if (window._templateGallerySections && window._templateGallerySections.length > 0) {
          const sections = window._templateGallerySections.map((sectionName, index) => ({
            event_id: newEvent.id,
            gallery_name: sectionName,
            gallery_description: '',
            display_order: index + 1
          }));

          const { error: sectionsError } = await STATE.client
            .from('event_galleries')
            .insert(sections);

          if (!sectionsError) {
            console.log(`✅ Created ${sections.length} gallery sections from template`);
          }

          // Clear template sections
          window._templateGallerySections = [];
        }
      }

      utils.showToast(`Event ${eventId ? 'updated' : 'added'} successfully!`, 'success');

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
      await this.loadEvents();

    } catch (error) {
      console.error('Error saving event:', error);
      utils.showToast('Error saving event: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete event
   */
  async deleteEvent(eventId, eventName) {
    if (!confirm(`Are you sure you want to delete "${eventName}"?\n\nNote: Media associated with this event will NOT be deleted, but will be unlinked from the event.`)) {
      return;
    }

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      utils.showToast('Event deleted successfully!', 'success');
      await this.loadEvents();

    } catch (error) {
      console.error('Error deleting event:', error);
      utils.showToast('Error deleting event: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* EVENT CLONING */
  /* ==================================================== */

  /**
   * Open clone event modal
   */
  async openCloneModal(eventId) {
    const sourceEvent = STATE.allEvents.find(e => e.id === eventId);
    if (!sourceEvent) return;

    // Set source event details
    document.getElementById('cloneEventSourceId').value = eventId;
    document.getElementById('cloneEventSourceName').textContent = sourceEvent.event_name;

    // Pre-fill form with source event data (incrementing year by 1)
    const nextYear = sourceEvent.year ? parseInt(sourceEvent.year) + 1 : new Date().getFullYear();
    document.getElementById('cloneEventName').value = sourceEvent.event_name.replace(/\d{4}/, nextYear);
    document.getElementById('cloneEventYear').value = nextYear;
    document.getElementById('cloneEventVenue').value = sourceEvent.venue || '';
    document.getElementById('cloneEventDescription').value = sourceEvent.description || '';
    document.getElementById('cloneEventDate').value = '';
    document.getElementById('cloneGallerySections').checked = true;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('cloneEventModal'));
    modal.show();
  },

  /**
   * Clone event (and optionally gallery sections)
   */
  async cloneEvent() {
    const sourceEventId = document.getElementById('cloneEventSourceId').value;
    const newEventName = document.getElementById('cloneEventName').value.trim();
    const newEventDate = document.getElementById('cloneEventDate').value;
    const newEventYear = document.getElementById('cloneEventYear').value;
    const newEventVenue = document.getElementById('cloneEventVenue').value.trim();
    const newEventDescription = document.getElementById('cloneEventDescription').value.trim();
    const cloneGallerySections = document.getElementById('cloneGallerySections').checked;

    if (!newEventName || !newEventYear) {
      utils.showToast('Please enter event name and year', 'warning');
      return;
    }

    try {
      utils.showLoading();

      // Step 1: Create new event
      const newEventData = {
        event_name: newEventName,
        event_date: newEventDate || null,
        year: parseInt(newEventYear),
        venue: newEventVenue || null,
        description: newEventDescription || null,
        event_status: 'draft'
      };

      const { data: newEvent, error: eventError } = await STATE.client
        .from('events')
        .insert([newEventData])
        .select()
        .single();

      if (eventError) throw eventError;

      utils.showToast(`Event "${newEventName}" created successfully!`, 'success');

      // Step 2: Clone gallery sections if requested
      if (cloneGallerySections) {
        await this.cloneGallerySections(sourceEventId, newEvent.id);
      }

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('cloneEventModal')).hide();
      await this.loadEvents();

      // Show success summary
      const message = cloneGallerySections
        ? `Event cloned successfully with gallery sections!`
        : `Event cloned successfully!`;

      utils.showToast(message, 'success');

    } catch (error) {
      console.error('Error cloning event:', error);
      utils.showToast('Error cloning event: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Clone gallery sections from source event to new event
   */
  async cloneGallerySections(sourceEventId, newEventId) {
    try {
      // Get all gallery sections from source event
      const { data: sections, error: sectionsError } = await STATE.client
        .from('event_galleries')
        .select('*')
        .eq('event_id', sourceEventId)
        .order('display_order', { ascending: true });

      if (sectionsError) throw sectionsError;

      if (!sections || sections.length === 0) {
        console.log('No gallery sections to clone');
        return;
      }

      // Create new sections for the new event
      const newSections = sections.map(section => ({
        event_id: newEventId,
        gallery_name: section.gallery_name,
        gallery_description: section.gallery_description,
        display_order: section.display_order
      }));

      const { error: insertError } = await STATE.client
        .from('event_galleries')
        .insert(newSections);

      if (insertError) throw insertError;

      console.log(`✅ Cloned ${sections.length} gallery section(s)`);

    } catch (error) {
      console.error('Error cloning gallery sections:', error);
      // Don't throw - let the event creation succeed even if sections fail
      utils.showToast('Event created but gallery sections failed to clone', 'warning');
    }
  },

  /* ==================================================== */
  /* EVENT TEMPLATES */
  /* ==================================================== */

  /**
   * Load templates from localStorage
   */
  loadTemplates() {
    try {
      const stored = localStorage.getItem('eventTemplates');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading templates:', error);
      return [];
    }
  },

  /**
   * Save templates to localStorage
   */
  saveTemplatesStorage(templates) {
    try {
      localStorage.setItem('eventTemplates', JSON.stringify(templates));
    } catch (error) {
      console.error('Error saving templates:', error);
      utils.showToast('Error saving templates', 'error');
    }
  },

  /**
   * Open templates manager modal
   */
  openTemplatesManager() {
    // Load and display templates
    this.renderTemplatesList();

    // Hide form section
    document.getElementById('templateFormSection').classList.add('d-none');

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('eventTemplatesModal'));
    modal.show();
  },

  /**
   * Render templates list
   */
  renderTemplatesList() {
    const templates = this.loadTemplates();
    const container = document.getElementById('eventTemplatesList');
    const countEl = document.getElementById('templatesCount');

    countEl.textContent = templates.length;

    if (templates.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info text-center">
          <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
          <p class="mb-0">No templates created yet. Click "Create Template" to get started.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = templates.map((template, index) => `
      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <h6 class="card-title mb-2">
                <i class="bi bi-layout-text-sidebar me-2 text-secondary"></i>
                ${utils.escapeHtml(template.name)}
              </h6>
              <p class="card-text small text-muted mb-2">
                ${template.venue ? `<i class="bi bi-geo-alt me-1"></i>${utils.escapeHtml(template.venue)}<br>` : ''}
                ${template.description ? `<i class="bi bi-text-paragraph me-1"></i>${utils.escapeHtml(template.description)}` : ''}
              </p>
              ${template.gallerySections && template.gallerySections.length > 0 ? `
                <div class="small">
                  <strong>Gallery Sections:</strong> ${template.gallerySections.map(s => utils.escapeHtml(s)).join(', ')}
                </div>
              ` : ''}
            </div>
            <div class="btn-group btn-group-sm ms-3" role="group">
              <button class="btn btn-outline-success btn-icon"
                onclick="eventsModule.useTemplate(${index})"
                title="Use Template">
                <i class="bi bi-play-fill"></i>
              </button>
              <button class="btn btn-outline-primary btn-icon"
                onclick="eventsModule.editTemplate(${index})"
                title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-icon"
                onclick="eventsModule.deleteTemplate(${index})"
                title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  },

  /**
   * Open create template form
   */
  openCreateTemplate() {
    document.getElementById('templateFormTitle').innerHTML =
      '<i class="bi bi-plus-circle me-2"></i>Create New Template';
    document.getElementById('templateId').value = '';
    document.getElementById('templateName').value = '';
    document.getElementById('templateVenue').value = '';
    document.getElementById('templateDescription').value = '';
    document.getElementById('templateGallerySections').value = '';

    document.getElementById('templateFormSection').classList.remove('d-none');
  },

  /**
   * Edit template
   */
  editTemplate(index) {
    const templates = this.loadTemplates();
    const template = templates[index];

    if (!template) return;

    document.getElementById('templateFormTitle').innerHTML =
      '<i class="bi bi-pencil me-2"></i>Edit Template';
    document.getElementById('templateId').value = index;
    document.getElementById('templateName').value = template.name || '';
    document.getElementById('templateVenue').value = template.venue || '';
    document.getElementById('templateDescription').value = template.description || '';
    document.getElementById('templateGallerySections').value =
      template.gallerySections ? template.gallerySections.join('\n') : '';

    document.getElementById('templateFormSection').classList.remove('d-none');
    document.getElementById('templateFormSection').scrollIntoView({ behavior: 'smooth' });
  },

  /**
   * Save template
   */
  saveTemplate() {
    const name = document.getElementById('templateName').value.trim();
    const venue = document.getElementById('templateVenue').value.trim();
    const description = document.getElementById('templateDescription').value.trim();
    const gallerySectionsText = document.getElementById('templateGallerySections').value.trim();
    const templateId = document.getElementById('templateId').value;

    if (!name) {
      utils.showToast('Please enter a template name', 'warning');
      return;
    }

    // Parse gallery sections
    const gallerySections = gallerySectionsText
      ? gallerySectionsText.split('\n').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    const template = {
      name,
      venue,
      description,
      gallerySections
    };

    const templates = this.loadTemplates();

    if (templateId !== '') {
      // Update existing template
      const index = parseInt(templateId);
      templates[index] = template;
      utils.showToast('Template updated successfully!', 'success');
    } else {
      // Create new template
      templates.push(template);
      utils.showToast('Template created successfully!', 'success');
    }

    this.saveTemplatesStorage(templates);
    this.renderTemplatesList();
    this.cancelTemplateEdit();
  },

  /**
   * Delete template
   */
  deleteTemplate(index) {
    if (!utils.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    const templates = this.loadTemplates();
    templates.splice(index, 1);
    this.saveTemplatesStorage(templates);
    this.renderTemplatesList();
    utils.showToast('Template deleted successfully!', 'success');
  },

  /**
   * Cancel template edit
   */
  cancelTemplateEdit() {
    document.getElementById('templateFormSection').classList.add('d-none');
    document.getElementById('templateForm').reset();
  },

  /**
   * Use template to create new event
   */
  async useTemplate(index) {
    const templates = this.loadTemplates();
    const template = templates[index];

    if (!template) return;

    // Close templates modal
    bootstrap.Modal.getInstance(document.getElementById('eventTemplatesModal')).hide();

    // Wait a bit for modal to close
    await new Promise(resolve => setTimeout(resolve, 300));

    // Open add event modal with template data
    document.getElementById('eventModalTitle').textContent = `Add Event (from "${template.name}" template)`;
    document.getElementById('eventId').value = '';
    document.getElementById('eventName').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventYear').value = new Date().getFullYear();
    document.getElementById('eventVenue').value = template.venue || '';
    document.getElementById('eventDescription').value = template.description || '';
    document.getElementById('eventStatus').value = 'draft';
    document.getElementById('saveEventBtn').textContent = 'Add Event';

    // Store template gallery sections for later use
    window._templateGallerySections = template.gallerySections || [];

    const modal = new bootstrap.Modal(document.getElementById('eventModal'));
    modal.show();

    utils.showToast(`Using "${template.name}" template. Gallery sections will be created automatically.`, 'info');
  },

  /* ==================================================== */
  /* ATTENDEES & RSVP MANAGEMENT */
  /* ==================================================== */

  /**
   * Get attendees for an event from localStorage
   */
  getAttendees(eventId) {
    const key = `event_attendees_${eventId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  /**
   * Save attendees for an event to localStorage
   */
  saveAttendees(eventId, attendees) {
    const key = `event_attendees_${eventId}`;
    localStorage.setItem(key, JSON.stringify(attendees));
  },

  /**
   * Open attendees modal for an event
   */
  openAttendeesModal(eventId) {
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    document.getElementById('attendeesEventId').value = eventId;
    document.getElementById('attendeesEventName').textContent = event.event_name || 'Unnamed Event';
    document.getElementById('attendeesEventDate').textContent = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'No date set';
    document.getElementById('attendeesEventVenue').textContent = event.venue || 'No venue set';

    document.getElementById('addAttendeeForm').style.display = 'none';

    // Reset to attendees tab
    const firstTab = document.querySelector('#attendeesModal .nav-link.active');
    if (firstTab && !firstTab.getAttribute('href')?.includes('attendeesTab')) {
      const attendeesTabBtn = document.querySelector('#attendeesModal a[href="#attendeesTab"]');
      if (attendeesTabBtn) new bootstrap.Tab(attendeesTabBtn).show();
    }

    this.renderAttendees(eventId);
    this.renderCheckInTab(eventId);
    this.renderTicketsTab(eventId);

    const modal = new bootstrap.Modal(document.getElementById('attendeesModal'));
    modal.show();
  },

  /**
   * Render attendees table with all enhanced fields
   */
  renderAttendees(eventId) {
    const attendees = this.getAttendees(eventId);
    const tbody = document.getElementById('attendeesTableBody');

    const attending = attendees.filter(a => a.status === 'attending').length;
    const notAttending = attendees.filter(a => a.status === 'not_attending').length;
    const maybe = attendees.filter(a => a.status === 'maybe').length;

    document.getElementById('attendingCount').textContent = attending;
    document.getElementById('notAttendingCount').textContent = notAttending;
    document.getElementById('maybeCount').textContent = maybe;
    document.getElementById('totalAttendeesCount').textContent = attendees.length;

    // Venue capacity tracker
    const event = STATE.allEvents.find(e => e.id === eventId);
    const capacityTracker = document.getElementById('venueCapacityTracker');
    if (capacityTracker && event && event.capacity) {
      const capacity = event.capacity;
      const totalHeads = attendees.filter(a => a.status === 'attending').reduce((s, a) => s + 1 + (a.plusOnes || 0), 0);
      const pct = Math.round(totalHeads / capacity * 100);
      const remaining = capacity - totalHeads;
      const barColor = pct >= 95 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : pct >= 50 ? 'bg-info' : 'bg-success';
      const badgeColor = pct >= 95 ? 'bg-danger' : pct >= 80 ? 'bg-warning text-dark' : 'bg-success';

      document.getElementById('capacityAttendingNum').textContent = totalHeads;
      document.getElementById('capacityTotalNum').textContent = capacity;
      const pctBadge = document.getElementById('capacityPctBadge');
      pctBadge.textContent = pct + '% full';
      pctBadge.className = 'badge ms-2 ' + badgeColor;
      const bar = document.getElementById('capacityProgressBar');
      bar.style.width = Math.min(pct, 100) + '%';
      bar.className = 'progress-bar ' + barColor;
      document.getElementById('capacityRemainingText').textContent = remaining > 0
        ? `${remaining} seat${remaining !== 1 ? 's' : ''} remaining (incl. plus-ones)`
        : 'Venue is at capacity!';
      const warningEl = document.getElementById('capacityWarningText');
      if (pct >= 100) {
        warningEl.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-danger me-1"></i><span class="text-danger fw-bold">Over capacity!</span>';
      } else if (pct >= 90) {
        warningEl.innerHTML = '<i class="bi bi-exclamation-triangle text-warning me-1"></i><span class="text-warning">Almost full</span>';
      } else { warningEl.textContent = ''; }
      capacityTracker.style.display = 'block';
    } else if (capacityTracker) {
      capacityTracker.style.display = 'none';
    }

    // Dietary summary
    this.renderDietarySummary(attendees);

    if (attendees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">
        <i class="bi bi-people display-4 d-block mb-2 opacity-25"></i>
        No attendees yet. Click "Add Attendee" to start tracking RSVPs.</td></tr>`;
      return;
    }

    // Apply filters
    const filtered = this._filterAttendees(attendees);

    const typeBadges = {
      'vip': '<span class="badge bg-warning text-dark">VIP</span>',
      'speaker': '<span class="badge bg-primary">Speaker</span>',
      'sponsor': '<span class="badge bg-info">Sponsor</span>',
      'media': '<span class="badge bg-purple" style="background:#6f42c1!important;">Media</span>',
      'staff': '<span class="badge bg-secondary">Staff</span>',
      'guest': '<span class="badge bg-light text-dark">Guest</span>'
    };
    const statusBadges = {
      'attending': '<span class="badge bg-success">Attending</span>',
      'not_attending': '<span class="badge bg-danger">Not Attending</span>',
      'maybe': '<span class="badge bg-warning text-dark">Maybe</span>'
    };

    tbody.innerHTML = filtered.map(a => `
      <tr>
        <td class="fw-semibold">
          ${utils.escapeHtml(a.name)}
          ${a.checkedIn ? '<i class="bi bi-check-circle-fill text-success ms-1" title="Checked in"></i>' : ''}
        </td>
        <td><small>${a.email ? utils.escapeHtml(a.email) : '-'}</small></td>
        <td>${typeBadges[a.guestType || 'guest'] || typeBadges['guest']}</td>
        <td>${statusBadges[a.status] || a.status}</td>
        <td class="text-center">${a.plusOnes ? '+' + a.plusOnes : '-'}</td>
        <td><small class="text-muted">${a.dietary ? utils.escapeHtml(a.dietary) : '-'}</small></td>
        <td><small class="text-muted">${a.notes ? utils.escapeHtml(a.notes) : '-'}</small></td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary btn-sm"
              onclick="eventsModule.updateAttendeeStatus('${a.id}', '${a.status === 'attending' ? 'not_attending' : 'attending'}')"
              title="Toggle RSVP"><i class="bi bi-arrow-repeat"></i></button>
            <button class="btn btn-outline-danger btn-sm"
              onclick="eventsModule.deleteAttendee('${a.id}')" title="Remove"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  // ---- DIETARY SUMMARY ----

  renderDietarySummary(attendees) {
    const card = document.getElementById('dietarySummaryCard');
    const content = document.getElementById('dietarySummaryContent');
    if (!card || !content) return;

    const attending = attendees.filter(a => a.status === 'attending');
    const dietaryMap = {};
    attending.forEach(a => {
      if (a.dietary && a.dietary.trim()) {
        // Split on commas to handle "Vegetarian, Nut Allergy"
        a.dietary.split(',').forEach(d => {
          const key = d.trim().toLowerCase();
          if (key) {
            const label = d.trim().charAt(0).toUpperCase() + d.trim().slice(1).toLowerCase();
            if (!dietaryMap[key]) dietaryMap[key] = { label, count: 0 };
            dietaryMap[key].count++;
          }
        });
      }
    });

    const entries = Object.values(dietaryMap).sort((a, b) => b.count - a.count);
    if (entries.length === 0) {
      card.style.display = 'none';
      return;
    }

    const noDietary = attending.length - attending.filter(a => a.dietary && a.dietary.trim()).length;
    content.innerHTML = entries.map(e =>
      `<span class="badge bg-outline-secondary border" style="font-size:0.8rem;">${utils.escapeHtml(e.label)} <strong class="ms-1">${e.count}</strong></span>`
    ).join('') + (noDietary > 0 ? `<span class="badge bg-light text-muted border" style="font-size:0.8rem;">No requirements <strong class="ms-1">${noDietary}</strong></span>` : '');
    card.style.display = 'block';
  },

  exportDietarySummary() {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = this.getAttendees(eventId).filter(a => a.status === 'attending');
    const event = STATE.allEvents.find(e => e.id === eventId);
    const eventName = event ? event.event_name : 'Event';

    const exportData = attendees
      .filter(a => a.dietary && a.dietary.trim())
      .map(a => ({
        'Guest Name': a.name,
        'Dietary Requirements': a.dietary,
        'Guest Type': (a.guestType || 'guest').charAt(0).toUpperCase() + (a.guestType || 'guest').slice(1),
        'Plus Ones': a.plusOnes || 0,
        'Notes': a.notes || ''
      }));

    if (exportData.length === 0) {
      utils.showToast('No dietary requirements to export', 'info');
      return;
    }

    const filename = `${eventName.replace(/[^a-z0-9]/gi, '_')}_dietary_report_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
    utils.showToast('Dietary report exported', 'success');
  },

  // ---- ATTENDEE FILTERING ----

  _filterAttendees(attendees) {
    const search = (document.getElementById('attendeeSearchFilter')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('attendeeStatusFilter')?.value || '';
    const typeFilter = document.getElementById('attendeeTypeFilter')?.value || '';

    return attendees.filter(a => {
      if (search && !(a.name || '').toLowerCase().includes(search) && !(a.email || '').toLowerCase().includes(search)) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (typeFilter && (a.guestType || 'guest') !== typeFilter) return false;
      return true;
    });
  },

  filterAttendeesList() {
    const eventId = document.getElementById('attendeesEventId').value;
    this.renderAttendees(eventId);
  },

  // ---- ADD / UPDATE / DELETE ATTENDEES ----

  openAddAttendeeForm() {
    const form = document.getElementById('addAttendeeForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    document.getElementById('attendeeName').value = '';
    document.getElementById('attendeeEmail').value = '';
    document.getElementById('attendeeStatus').value = 'attending';
    document.getElementById('attendeeType').value = 'guest';
    document.getElementById('attendeePlusOnes').value = '0';
    document.getElementById('attendeeDietary').value = '';
    document.getElementById('attendeeNotes').value = '';
  },

  addAttendee() {
    const eventId = document.getElementById('attendeesEventId').value;
    const name = document.getElementById('attendeeName').value.trim();
    const email = document.getElementById('attendeeEmail').value.trim();
    const status = document.getElementById('attendeeStatus').value;
    const guestType = document.getElementById('attendeeType').value;
    const plusOnes = parseInt(document.getElementById('attendeePlusOnes').value) || 0;
    const dietary = document.getElementById('attendeeDietary').value.trim();
    const notes = document.getElementById('attendeeNotes').value.trim();

    if (!name) {
      utils.showToast('Please enter attendee name', 'warning');
      return;
    }

    const attendees = this.getAttendees(eventId);
    attendees.push({
      id: `attendee_${Date.now()}`,
      name, email, status, guestType, plusOnes, dietary, notes,
      checkedIn: false,
      checkInTime: null,
      addedAt: new Date().toISOString()
    });
    this.saveAttendees(eventId, attendees);

    document.getElementById('attendeeName').value = '';
    document.getElementById('attendeeEmail').value = '';
    document.getElementById('attendeeDietary').value = '';
    document.getElementById('attendeeNotes').value = '';
    document.getElementById('attendeePlusOnes').value = '0';
    document.getElementById('addAttendeeForm').style.display = 'none';

    this.renderAttendees(eventId);
    this.renderCheckInTab(eventId);
    utils.showToast('Attendee added', 'success');
  },

  updateAttendeeStatus(attendeeId, newStatus) {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = this.getAttendees(eventId);
    const attendee = attendees.find(a => a.id === attendeeId);
    if (attendee) {
      attendee.status = newStatus;
      this.saveAttendees(eventId, attendees);
      this.renderAttendees(eventId);
      this.renderCheckInTab(eventId);
      utils.showToast('Status updated', 'success');
    }
  },

  deleteAttendee(attendeeId) {
    if (!confirm('Remove this attendee from the list?')) return;
    const eventId = document.getElementById('attendeesEventId').value;
    let attendees = this.getAttendees(eventId);
    attendees = attendees.filter(a => a.id !== attendeeId);
    this.saveAttendees(eventId, attendees);
    this.renderAttendees(eventId);
    this.renderCheckInTab(eventId);
    utils.showToast('Attendee removed', 'success');
  },

  // ---- CHECK-IN SYSTEM ----

  renderCheckInTab(eventId) {
    const attendees = this.getAttendees(eventId);
    const attending = attendees.filter(a => a.status === 'attending');
    const checkedIn = attending.filter(a => a.checkedIn);
    const pending = attending.filter(a => !a.checkedIn);
    const pct = attending.length > 0 ? Math.round(checkedIn.length / attending.length * 100) : 0;

    const checkedCountEl = document.getElementById('checkInCheckedCount');
    const pendingCountEl = document.getElementById('checkInPendingCount');
    const progressBar = document.getElementById('checkInProgressBar');
    const badge = document.getElementById('checkedInBadge');

    if (checkedCountEl) checkedCountEl.textContent = checkedIn.length;
    if (pendingCountEl) pendingCountEl.textContent = pending.length;
    if (progressBar) {
      progressBar.style.width = pct + '%';
      progressBar.textContent = pct + '%';
    }
    if (badge) {
      badge.textContent = checkedIn.length;
      badge.style.display = checkedIn.length > 0 ? 'inline' : 'none';
    }

    const tbody = document.getElementById('checkInTableBody');
    if (!tbody) return;

    const search = (document.getElementById('checkInSearch')?.value || '').toLowerCase();
    const filtered = attending.filter(a => !search || (a.name || '').toLowerCase().includes(search));

    // Sort: unchecked first, then checked
    filtered.sort((a, b) => {
      if (a.checkedIn && !b.checkedIn) return 1;
      if (!a.checkedIn && b.checkedIn) return -1;
      return (a.name || '').localeCompare(b.name || '');
    });

    const typeBadges = {
      'vip': '<span class="badge bg-warning text-dark">VIP</span>',
      'speaker': '<span class="badge bg-primary">Speaker</span>',
      'sponsor': '<span class="badge bg-info">Sponsor</span>',
      'media': '<span class="badge bg-purple" style="background:#6f42c1!important;">Media</span>',
      'staff': '<span class="badge bg-secondary">Staff</span>',
      'guest': '<span class="badge bg-light text-dark">Guest</span>'
    };

    tbody.innerHTML = filtered.map(a => `
      <tr class="${a.checkedIn ? 'table-success' : ''}">
        <td class="fw-semibold">
          ${a.checkedIn ? '<i class="bi bi-check-circle-fill text-success me-1"></i>' : '<i class="bi bi-circle text-muted me-1"></i>'}
          ${utils.escapeHtml(a.name)}
          ${a.plusOnes ? `<small class="text-muted ms-1">(+${a.plusOnes})</small>` : ''}
        </td>
        <td>${typeBadges[a.guestType || 'guest'] || ''}</td>
        <td>${a.dietary ? `<small class="text-muted"><i class="bi bi-egg-fried me-1"></i>${utils.escapeHtml(a.dietary)}</small>` : '-'}</td>
        <td><small>${a.checkedIn && a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) : '-'}</small></td>
        <td class="text-center">
          ${a.checkedIn
            ? `<button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.toggleCheckIn('${a.id}')"><i class="bi bi-x-circle me-1"></i>Undo</button>`
            : `<button class="btn btn-sm btn-success" onclick="eventsModule.toggleCheckIn('${a.id}')"><i class="bi bi-check-lg me-1"></i>Check In</button>`
          }
        </td>
      </tr>
    `).join('');
  },

  toggleCheckIn(attendeeId) {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = this.getAttendees(eventId);
    const attendee = attendees.find(a => a.id === attendeeId);
    if (attendee) {
      attendee.checkedIn = !attendee.checkedIn;
      attendee.checkInTime = attendee.checkedIn ? new Date().toISOString() : null;
      this.saveAttendees(eventId, attendees);
      this.renderCheckInTab(eventId);
      this.renderAttendees(eventId);
      utils.showToast(attendee.checkedIn ? `${attendee.name} checked in` : `${attendee.name} check-in undone`, attendee.checkedIn ? 'success' : 'info');
    }
  },

  checkInAll() {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = this.getAttendees(eventId);
    const unchecked = attendees.filter(a => a.status === 'attending' && !a.checkedIn);
    if (unchecked.length === 0) {
      utils.showToast('All attending guests are already checked in', 'info');
      return;
    }
    if (!confirm(`Check in all ${unchecked.length} attending guest(s)?`)) return;
    const now = new Date().toISOString();
    unchecked.forEach(a => { a.checkedIn = true; a.checkInTime = now; });
    this.saveAttendees(eventId, attendees);
    this.renderCheckInTab(eventId);
    this.renderAttendees(eventId);
    utils.showToast(`${unchecked.length} guest(s) checked in`, 'success');
  },

  filterCheckInList() {
    const eventId = document.getElementById('attendeesEventId').value;
    this.renderCheckInTab(eventId);
  },

  // ---- TICKETS TAB ----

  renderTicketsTab(eventId) {
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    const attendees = this.getAttendees(eventId);
    const ticketsSold = attendees.filter(a => a.status === 'attending').length;
    const price = event.ticket_price || 0;
    const capacity = event.capacity || 0;

    const priceEl = document.getElementById('ticketPriceDisplay');
    const soldEl = document.getElementById('ticketsSoldCount');
    const revenueEl = document.getElementById('ticketRevenueDisplay');
    const remainingEl = document.getElementById('ticketsRemainingCount');
    const priceInput = document.getElementById('ticketPriceInput');
    const urlInput = document.getElementById('ticketUrlInput');
    const copyBtn = document.getElementById('ticketUrlCopyBtn');

    if (priceEl) priceEl.textContent = price > 0 ? `\u00A3${parseFloat(price).toFixed(2)}` : 'Free';
    if (soldEl) soldEl.textContent = ticketsSold;
    if (revenueEl) revenueEl.textContent = price > 0 ? `\u00A3${(ticketsSold * price).toFixed(2)}` : '-';
    if (remainingEl) remainingEl.textContent = capacity > 0 ? Math.max(0, capacity - ticketsSold) : '-';
    if (priceInput) priceInput.value = price || '';
    if (urlInput) urlInput.value = event.ticket_url || '';
    if (copyBtn) copyBtn.style.display = event.ticket_url ? 'block' : 'none';

    // Populate registration & check-in links
    const baseUrl = this._getBaseUrl();
    const regLink = document.getElementById('registrationLinkDisplay');
    const ciLink = document.getElementById('checkInLinkDisplay');
    if (regLink) regLink.value = `${baseUrl}/register.html?event=${eventId}`;
    if (ciLink) ciLink.value = `${baseUrl}/check-in.html?event=${eventId}`;
  },

  async saveTicketSettings() {
    const eventId = document.getElementById('attendeesEventId').value;
    const price = parseFloat(document.getElementById('ticketPriceInput').value) || null;
    const url = document.getElementById('ticketUrlInput').value.trim() || null;

    try {
      const { error } = await STATE.client
        .from('events')
        .update({ ticket_price: price, ticket_url: url })
        .eq('id', eventId);
      if (error) throw error;

      // Update local state
      const event = STATE.allEvents.find(e => e.id === eventId);
      if (event) { event.ticket_price = price; event.ticket_url = url; }

      this.renderTicketsTab(eventId);
      utils.showToast('Ticket settings saved', 'success');
    } catch (error) {
      console.error('Error saving ticket settings:', error);
      utils.showToast('Failed to save ticket settings', 'error');
    }
  },

  copyTicketUrl() {
    const url = document.getElementById('ticketUrlInput').value;
    if (url) {
      navigator.clipboard.writeText(url);
      utils.showToast('Ticket URL copied to clipboard', 'success');
    }
  },

  // ---- REGISTRATION & CHECK-IN LINKS ----

  _getBaseUrl() {
    return window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
  },

  copyRegistrationLink() {
    const eventId = document.getElementById('attendeesEventId').value;
    const url = `${this._getBaseUrl()}/register.html?event=${eventId}`;
    navigator.clipboard.writeText(url);
    utils.showToast('Registration link copied to clipboard', 'success');
  },

  copyCheckInLink() {
    const eventId = document.getElementById('attendeesEventId').value;
    const url = `${this._getBaseUrl()}/check-in.html?event=${eventId}`;
    navigator.clipboard.writeText(url);
    utils.showToast('Check-in scanner link copied to clipboard', 'success');
  },

  launchCheckInScanner() {
    const eventId = document.getElementById('attendeesEventId').value;
    const url = `${this._getBaseUrl()}/check-in.html?event=${eventId}`;
    window.open(url, '_blank');
  },

  // ---- EXPORT ATTENDEES ----

  exportAttendees() {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = this.getAttendees(eventId);

    if (attendees.length === 0) {
      utils.showToast('No attendees to export', 'warning');
      return;
    }

    const event = STATE.allEvents.find(e => e.id === eventId);
    const eventName = event ? event.event_name : 'Event';

    const exportData = attendees.map(a => ({
      'Name': a.name,
      'Email': a.email || '',
      'Type': (a.guestType || 'guest').charAt(0).toUpperCase() + (a.guestType || 'guest').slice(1),
      'RSVP Status': (a.status || '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      'Plus Ones': a.plusOnes || 0,
      'Dietary': a.dietary || '',
      'Notes': a.notes || '',
      'Checked In': a.checkedIn ? 'Yes' : 'No',
      'Check-In Time': a.checkInTime ? new Date(a.checkInTime).toLocaleString() : '',
      'Added On': utils.formatDate(a.addedAt)
    }));

    const filename = `${eventName.replace(/[^a-z0-9]/gi, '_')}_attendees_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  // ========================================
  // RUNNING ORDER MANAGEMENT
  // ========================================

  currentEventIdRunningOrder: null,
  currentEventName: null,
  runningOrderItems: [],
  isPublished: false,
  draggedItemId: null,
  _roUndoStack: [],
  _roSearchTerm: '',
  _roAutoSave: true,
  _roTouchStartY: 0,
  _roTouchItem: null,
  _roCeremonyStartTime: null,
  _roAutoSchedule: false,
  _roBackstageInterval: null,

  /**
   * Open Running Order Modal
   */
  async openRunningOrderModal(eventId, eventName) {
    this.currentEventIdRunningOrder = eventId;
    this.currentEventName = eventName;
    this._roUndoStack = [];
    this._roSearchTerm = '';
    this._roCeremonyStartTime = null;
    this._roAutoSchedule = false;

    try {
      utils.showLoading();
      await this.loadRunningOrder();
      await this.loadSectionConfig();
      this.createRunningOrderModal();
    } catch (error) {
      console.error('Error opening running order:', error);
      utils.showToast('Failed to load running order: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Create Running Order Modal - Enhanced with drag handles, numbered column, search, undo
   */
  createRunningOrderModal() {
    const existingModal = document.getElementById('runningOrderModal');
    if (existingModal) existingModal.remove();

    const itemCount = this.runningOrderItems.length;
    const totalDuration = this.runningOrderItems.reduce((sum, i) => sum + (i.duration_minutes || 3), 0);
    const completedCount = this.runningOrderItems.filter(i => i.status === 'completed').length;
    const announcedCount = this.runningOrderItems.filter(i => i.status === 'announced').length;

    const modalHtml = `
      <div class="modal fade" id="runningOrderModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header bg-warning text-dark">
              <div>
                <h5 class="modal-title">
                  <i class="bi bi-list-ol me-2"></i>Running Order - ${utils.escapeHtml(this.currentEventName)}
                </h5>
                <small class="text-muted d-block">Drag items to reorder, or use arrow buttons</small>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0">

              <!-- Status + Stats Bar -->
              <div class="px-3 pt-3">
                <div class="alert ${this.isPublished ? 'alert-success' : 'alert-info'} py-2 d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <i class="bi ${this.isPublished ? 'bi-lock-fill' : 'bi-unlock-fill'} me-2"></i>
                    <strong>${this.isPublished ? 'PUBLISHED' : 'EDIT MODE'}</strong>
                    <span class="ms-2 small">
                      ${this.isPublished ? 'Locked. Unpublish to edit.' : 'Drag to reorder. Auto-numbered.'}
                    </span>
                  </div>
                  <button class="btn btn-sm ${this.isPublished ? 'btn-outline-primary' : 'btn-success'}"
                          onclick="eventsModule.togglePublishMode()">
                    <i class="bi ${this.isPublished ? 'bi-unlock' : 'bi-lock'} me-1"></i>
                    ${this.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                </div>

                <!-- Stats Row with Schedule Tracking -->
                <div class="d-flex gap-3 mb-2 small align-items-center">
                  <span class="badge bg-secondary">${itemCount} items</span>
                  <span class="badge bg-info">${totalDuration} min total</span>
                  ${completedCount > 0 ? `<span class="badge bg-success">${completedCount} completed</span>` : ''}
                  ${announcedCount > 0 ? `<span class="badge bg-warning text-dark">${announcedCount} announced</span>` : ''}
                  <span id="roScheduleIndicator"></span>
                </div>

                <!-- Auto-Schedule Row -->
                <div class="d-flex gap-2 align-items-center mb-2 p-2 bg-light rounded border">
                  <label class="form-label mb-0 small fw-semibold text-nowrap">Start Time:</label>
                  <input type="time" class="form-control form-control-sm" id="roCeremonyStartTime"
                         value="${this._roCeremonyStartTime || ''}"
                         onchange="eventsModule.setCeremonyStartTime(this.value)"
                         style="width:100px;" ${this.isPublished ? 'disabled' : ''}>
                  <div class="form-check form-switch ms-2 mb-0">
                    <input class="form-check-input" type="checkbox" id="roAutoScheduleToggle"
                           ${this._roAutoSchedule ? 'checked' : ''}
                           onchange="eventsModule.toggleAutoSchedule(this.checked)"
                           ${this.isPublished ? 'disabled' : ''}>
                    <label class="form-check-label small" for="roAutoScheduleToggle">Auto-schedule</label>
                  </div>
                  ${this._roAutoSchedule && this._roCeremonyStartTime ? `
                    <button class="btn btn-sm btn-outline-info ms-1" onclick="eventsModule.recalcAutoSchedule()" title="Recalculate all times">
                      <i class="bi bi-calculator me-1"></i>Recalc
                    </button>
                  ` : ''}
                  <div class="ms-auto">
                    <button class="btn btn-sm btn-dark" onclick="eventsModule.openBackstageView()" title="Open backstage/stage manager view">
                      <i class="bi bi-display me-1"></i>Backstage View
                    </button>
                  </div>
                </div>

                <!-- Actions Bar -->
                <div class="d-flex gap-2 flex-wrap align-items-center mb-2">
                  <button class="btn btn-sm btn-primary" onclick="eventsModule.syncFromRSVPs()" ${this.isPublished ? 'disabled' : ''}>
                    <i class="bi bi-arrow-repeat me-1"></i>Sync RSVPs
                  </button>
                  <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.addManualEntry()" ${this.isPublished ? 'disabled' : ''}>
                    <i class="bi bi-plus-circle me-1"></i>Add Entry
                  </button>
                  <button class="btn btn-sm btn-outline-dark" onclick="eventsModule.addSectionBreak()" ${this.isPublished ? 'disabled' : ''}>
                    <i class="bi bi-dash-lg me-1"></i>Add Break
                  </button>
                  <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.openSectionManager()" title="Manage acts/sections">
                    <i class="bi bi-palette me-1"></i>Sections
                  </button>
                  <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.exportRunningOrder()">
                    <i class="bi bi-download me-1"></i>Export
                  </button>
                  <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.printRunningOrder()">
                    <i class="bi bi-printer me-1"></i>Print
                  </button>
                  <button class="btn btn-sm btn-outline-warning" id="roUndoBtn" onclick="eventsModule.undoROReorder()" disabled title="Undo last reorder">
                    <i class="bi bi-arrow-counterclockwise me-1"></i>Undo
                  </button>
                  <div class="ms-auto d-flex align-items-center gap-2">
                    <div class="input-group input-group-sm" style="width:200px;">
                      <span class="input-group-text"><i class="bi bi-search"></i></span>
                      <input type="text" class="form-control" id="roSearchInput" placeholder="Search items..."
                             oninput="eventsModule.searchRunningOrder(this.value)">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Column Headers -->
              <!-- Tabs: Running Order / Checklist / Cue Sheet -->
              <div class="px-3 pt-2">
                <ul class="nav nav-tabs nav-tabs-sm" id="roViewTabs" role="tablist" style="font-size:0.8rem;">
                  <li class="nav-item"><a class="nav-link active" data-ro-tab="main" onclick="eventsModule.switchROTab('main')" style="cursor:pointer;"><i class="bi bi-list-ol me-1"></i>Running Order</a></li>
                  <li class="nav-item"><a class="nav-link" data-ro-tab="checklist" onclick="eventsModule.switchROTab('checklist')" style="cursor:pointer;"><i class="bi bi-check2-square me-1"></i>Checklist</a></li>
                  <li class="nav-item"><a class="nav-link" data-ro-tab="cuesheet" onclick="eventsModule.switchROTab('cuesheet')" style="cursor:pointer;"><i class="bi bi-camera-reels me-1"></i>Cue Sheet</a></li>
                  <li class="nav-item"><a class="nav-link" data-ro-tab="trophies" onclick="eventsModule.switchROTab('trophies')" style="cursor:pointer;"><i class="bi bi-trophy me-1"></i>Trophies</a></li>
                  <li class="nav-item"><a class="nav-link" data-ro-tab="versions" onclick="eventsModule.switchROTab('versions')" style="cursor:pointer;"><i class="bi bi-clock-history me-1"></i>Versions</a></li>
                </ul>
              </div>

              <!-- Main Running Order Tab -->
              <div id="roTabMain">
              <div class="ro-header-row px-3 py-2 bg-light border-top border-bottom d-flex align-items-center gap-2" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:#6c757d; font-weight:600;">
                <div style="width:32px;"></div>
                <div style="width:50px; text-align:center;">#</div>
                <div style="width:70px; text-align:center;">Time</div>
                <div class="flex-grow-1">Award / Winner</div>
                <div style="width:110px;">Sponsor</div>
                <div style="width:120px;">Collecting</div>
                <div style="width:90px; text-align:center;">Status</div>
                <div style="width:140px; text-align:center;">Actions</div>
              </div>

              <!-- Running Order List -->
              <div id="runningOrderList" class="running-order-list px-3 py-2" style="max-height:520px; overflow-y:auto;">
                <!-- Items rendered here -->
              </div>

              ${itemCount === 0 ? `
                <div class="text-center py-5">
                  <i class="bi bi-inbox display-4 d-block mb-3 opacity-25"></i>
                  <p class="text-muted">No items in running order yet.</p>
                  <button class="btn btn-primary" onclick="eventsModule.syncFromRSVPs()">
                    <i class="bi bi-arrow-repeat me-2"></i>Sync from RSVPs
                  </button>
                  <span class="mx-2 text-muted">or</span>
                  <button class="btn btn-outline-secondary" onclick="eventsModule.addManualEntry()">
                    <i class="bi bi-plus-circle me-2"></i>Add Manual Entry
                  </button>
                </div>
              ` : ''}
              </div><!-- /roTabMain -->

              <!-- Checklist Tab -->
              <div id="roTabChecklist" style="display:none;">
                <div id="roChecklistContent" class="px-3 py-2" style="max-height:520px; overflow-y:auto;">
                  <!-- Rendered by renderChecklistTab() -->
                </div>
              </div>

              <!-- Cue Sheet Tab -->
              <div id="roTabCuesheet" style="display:none;">
                <div id="roCueSheetContent" class="px-3 py-2" style="max-height:520px; overflow-y:auto;">
                  <!-- Rendered by renderCueSheetTab() -->
                </div>
              </div>

              <!-- Trophies Tab -->
              <div id="roTabTrophies" style="display:none;">
                <div id="roTrophiesContent" class="px-3 py-2" style="max-height:520px; overflow-y:auto;">
                  <!-- Rendered by renderTrophiesTab() -->
                </div>
              </div>

              <!-- Versions Tab -->
              <div id="roTabVersions" style="display:none;">
                <div id="roVersionsContent" class="px-3 py-2" style="max-height:520px; overflow-y:auto;">
                  <!-- Rendered by renderVersionsTab() -->
                </div>
              </div>

            </div>
            <div class="modal-footer d-flex justify-content-between">
              <div class="small text-muted">
                <i class="bi bi-info-circle me-1"></i>
                Tip: Use <kbd>&#x2191;</kbd>/<kbd>&#x2193;</kbd> arrows or drag the grip handle to reorder
              </div>
              <div>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" onclick="eventsModule.saveRunningOrder()">
                  <i class="bi bi-save me-2"></i>Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        .running-order-list { padding-bottom: 10px; }
        .ro-item {
          background: white;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          margin-bottom: 6px;
          transition: all 0.15s ease;
          user-select: none;
        }
        .ro-item:hover { border-color: #ffc107; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .ro-item.dragging { opacity: 0.4; border-color: #ffc107; transform: scale(0.98); }
        .ro-item.drag-placeholder { border: 2px dashed #ffc107; background: #fffbeb; min-height: 56px; }
        .ro-item.published { cursor: default; background: #f8f9fa; }
        .ro-item.status-completed { border-left: 4px solid #198754; }
        .ro-item.status-announced { border-left: 4px solid #ffc107; }
        .ro-item.search-hidden { display: none !important; }

        .ro-drag-handle {
          cursor: grab; color: #adb5bd; font-size: 1.1rem; padding: 4px;
          display: flex; align-items: center; justify-content: center;
          width: 32px; flex-shrink: 0;
        }
        .ro-drag-handle:hover { color: #495057; }
        .ro-drag-handle:active { cursor: grabbing; }

        .ro-number {
          width: 50px; flex-shrink: 0; text-align: center;
          font-size: 1.4rem; font-weight: 700; color: #ffc107;
          line-height: 1;
        }
        .ro-number .sub { font-size: 0.65rem; color: #adb5bd; font-weight: 400; display: block; }

        .ro-time {
          width: 70px; flex-shrink: 0; text-align: center;
        }
        .ro-time input {
          width: 62px; font-size: 0.75rem; text-align: center;
          border: 1px solid #dee2e6; border-radius: 4px; padding: 2px 4px;
          background: #f8f9fa;
        }
        .ro-time input:focus { border-color: #ffc107; outline: none; background: white; }
        .ro-time .duration { font-size: 0.65rem; color: #adb5bd; }

        .ro-details { flex-grow: 1; min-width: 0; overflow: hidden; }
        .ro-award-name { font-weight: 600; color: #333; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ro-winner-name { color: #0d6efd; font-weight: 500; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ro-notes-preview { font-size: 0.7rem; color: #adb5bd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .ro-recipient { width: 140px; flex-shrink: 0; font-size: 0.8rem; overflow: hidden; }
        .ro-recipient strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .ro-status { width: 90px; flex-shrink: 0; text-align: center; }
        .ro-status select { font-size: 0.7rem; padding: 2px 4px; border-radius: 4px; border: 1px solid #dee2e6; background: #f8f9fa; }

        .ro-actions { width: 120px; flex-shrink: 0; text-align: center; white-space: nowrap; }
        .ro-actions .btn { padding: 2px 6px; font-size: 0.75rem; }

        /* Grouped presentation styles */
        .ro-group-header {
          background: linear-gradient(135deg, #fff8e1 0%, #ffffff 100%);
          border: 2px solid #ffc107;
          border-radius: 8px 8px 0 0;
          margin-bottom: 0;
          margin-top: 10px;
          user-select: none;
        }
        .ro-group-header:hover { box-shadow: 0 2px 8px rgba(255,193,7,0.25); }
        .ro-grouped-item {
          background: #fffef8;
          border: 1px solid #f0e6c0;
          border-top: 1px dashed #e0d6a0;
          border-radius: 0;
          margin-bottom: 0;
          padding-left: 40px;
        }
        .ro-grouped-item:last-of-type,
        .ro-grouped-item + .ro-item:not(.ro-grouped-item),
        .ro-grouped-item + .ro-group-header {
          border-radius: 0 0 8px 8px;
          margin-bottom: 6px;
        }
        .ro-grouped-item + .ro-item:not(.ro-grouped-item) { border-radius: 8px; margin-top: 6px; }

        /* Section break / non-award items */
        .ro-item.ro-break-item {
          background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
          border: 2px dashed #7e57c2;
          border-radius: 8px;
        }
        .ro-item.ro-break-item:hover { border-color: #5e35b1; box-shadow: 0 2px 8px rgba(126,87,194,0.2); }
        .ro-break-label { font-weight: 700; color: #5e35b1; font-size: 0.9rem; }

        /* Sponsor column */
        .ro-sponsor { width: 110px; flex-shrink: 0; font-size: 0.75rem; overflow: hidden; }
        .ro-sponsor span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #6c757d; font-style: italic; }

        /* Schedule tracking */
        .schedule-ahead { color: #198754; font-weight: 600; }
        .schedule-behind { color: #dc3545; font-weight: 600; }
        .schedule-on-time { color: #6c757d; }

        /* Tab styles */
        #roViewTabs .nav-link { padding: 4px 12px; font-size: 0.78rem; color: #666; }
        #roViewTabs .nav-link.active { font-weight: 600; color: #333; }
        #roViewTabs .nav-link:hover { color: #000; }

        /* Checklist styles */
        .ro-checklist-item { padding: 10px 12px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 12px; }
        .ro-checklist-item:hover { background: #f8f9fa; }
        .ro-checklist-checks { display: flex; gap: 8px; }
        .ro-checklist-checks label { font-size: 0.72rem; color: #666; cursor: pointer; display: flex; align-items: center; gap: 3px; }
        .ro-checklist-checks input:checked + span { color: #198754; font-weight: 600; }
        .ro-checklist-progress { height: 6px; border-radius: 3px; background: #e9ecef; overflow: hidden; }
        .ro-checklist-progress-bar { height: 100%; border-radius: 3px; transition: width 0.3s; }

        /* Cue sheet styles */
        .ro-cue-item { padding: 10px 12px; border-bottom: 1px solid #eee; }
        .ro-cue-item:hover { background: #f8f9fa; }
        .ro-cue-notes-text { background: #1a1a2e; color: #4fc3f7; padding: 6px 10px; border-radius: 4px; font-family: monospace; font-size: 0.82rem; margin-top: 4px; }

        /* Trophy tracking styles */
        .ro-trophy-item { padding: 10px 12px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 12px; }
        .ro-trophy-item:hover { background: #f8f9fa; }
        .trophy-status-badge { font-size: 0.7rem; padding: 3px 8px; border-radius: 10px; }

        /* Section header styles */
        .ro-section-header {
          background: linear-gradient(90deg, var(--section-color, #6c757d) 0%, transparent 100%);
          color: white;
          padding: 6px 16px;
          margin: 8px 0 4px 0;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.85rem;
          letter-spacing: 0.5px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('runningOrderModal'));
    modal.show();

    this.renderRunningOrderItems();

    // Keyboard shortcuts for modal
    document.getElementById('runningOrderModal').addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undoROReorder(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); this.saveRunningOrder(); }
    });

    document.getElementById('runningOrderModal').addEventListener('hidden.bs.modal', () => {
      document.getElementById('runningOrderModal').remove();
    });
  },

  /**
   * Load Running Order from Database
   */
  async loadRunningOrder() {
    try {
      const { data: items, error: itemsError } = await STATE.client
        .from('running_order')
        .select(`
          *,
          organisations(company_name, logo_url),
          awards(award_name),
          event_guests(guest_name, guest_email)
        `)
        .eq('event_id', this.currentEventIdRunningOrder)
        .order('display_order', { ascending: true });

      if (itemsError) throw itemsError;
      this.runningOrderItems = items || [];

      const { data: settings, error: settingsError } = await STATE.client
        .from('running_order_settings')
        .select('*')
        .eq('event_id', this.currentEventIdRunningOrder)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error loading settings:', settingsError);
      }
      this.isPublished = settings?.is_published || false;
      this._roCeremonyStartTime = settings?.ceremony_start_time || null;
      this._roAutoSchedule = settings?.auto_schedule || false;
    } catch (error) {
      console.error('Error loading running order:', error);
      throw error;
    }
  },

  /**
   * Render Running Order Items - With grouping, section breaks, sponsor, schedule tracking
   */
  renderRunningOrderItems() {
    const container = document.getElementById('runningOrderList');
    if (!container || this.runningOrderItems.length === 0) return;

    let cumulativeMin = 0;
    const search = this._roSearchTerm.toLowerCase();
    const renderedGroups = new Set();
    let presentationNumber = 0;
    let currentSection = null;

    let html = '';

    this.runningOrderItems.forEach((item, index) => {
      // Section header rendering
      const itemSection = item.section || 1;
      if (this._roSectionConfig.length > 0 && itemSection !== currentSection) {
        currentSection = itemSection;
        const sectionConf = this.getSectionConfig(itemSection);
        if (sectionConf) {
          html += `<div class="ro-section-header" style="--section-color: ${sectionConf.colour};">
            <span><i class="bi bi-bookmark-fill me-2"></i>${utils.escapeHtml(sectionConf.name)}</span>
            <span style="font-size:0.7rem; font-weight:400;">Section ${itemSection}</span>
          </div>`;
        }
      }
      const recipientName = item.recipient_collecting || item.event_guests?.guest_name || item.display_name || 'TBC';
      const awardName = item.award_name || (item.awards ? item.awards.award_name : 'Award TBC');
      const winnerName = item.display_name || (item.organisations ? item.organisations.company_name : 'TBC');
      const duration = item.duration_minutes || 3;
      const cumTime = cumulativeMin;
      cumulativeMin += duration;
      const scheduledTime = item.scheduled_time || '';
      const notes = item.notes || item.special_requirements || '';
      const status = item.status || 'pending';
      const isFirst = index === 0;
      const isLast = index === this.runningOrderItems.length - 1;
      const itemType = item.item_type || 'award';
      const isBreak = itemType !== 'award';
      const sponsor = item.sponsor || '';

      // Search filtering
      const matchesSearch = !search || `${awardName} ${winnerName} ${recipientName} ${notes} ${sponsor}`.toLowerCase().includes(search);

      const statusOpts = ['pending', 'announced', 'completed'].map(s =>
        `<option value="${s}"${s === status ? ' selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
      ).join('');

      // Schedule tracking - compare actual vs scheduled
      const scheduleIndicator = this._roGetItemScheduleIndicator(item);

      // Section break / non-award item rendering
      if (isBreak) {
        presentationNumber++;
        const breakIcons = {
          'break': 'bi-cup-hot',
          'speech': 'bi-mic',
          'entertainment': 'bi-music-note-beamed',
          'interval': 'bi-pause-circle',
          'other': 'bi-bookmark'
        };
        const breakIcon = breakIcons[itemType] || 'bi-bookmark';
        const breakLabels = {
          'break': 'BREAK',
          'speech': 'SPEECH',
          'entertainment': 'ENTERTAINMENT',
          'interval': 'INTERVAL',
          'other': 'OTHER'
        };

        html += `
        <div class="ro-item ro-break-item ${this.isPublished ? 'published' : ''} ${status !== 'pending' ? 'status-' + status : ''} ${matchesSearch ? '' : 'search-hidden'}"
             draggable="${!this.isPublished}"
             data-id="${item.id}"
             data-index="${index}"
             ondragstart="eventsModule.handleDragStart(event)"
             ondragover="eventsModule.handleDragOver(event)"
             ondragleave="eventsModule.handleDragLeave(event)"
             ondrop="eventsModule.handleDrop(event)"
             ondragend="eventsModule.handleDragEnd(event)"
             ontouchstart="eventsModule.handleTouchStart(event)"
             ontouchmove="eventsModule.handleTouchMove(event)"
             ontouchend="eventsModule.handleTouchEnd(event)">
          <div class="d-flex align-items-center gap-2 py-2 px-2">
            ${!this.isPublished ? `<div class="ro-drag-handle" title="Drag to reorder"><i class="bi bi-grip-vertical"></i></div>` : '<div style="width:32px;"></div>'}
            <div class="ro-number" style="color:#7e57c2;">
              <i class="${breakIcon}" style="font-size:1.2rem;"></i>
              <span class="sub">${breakLabels[itemType] || 'BREAK'}</span>
            </div>
            <div class="ro-time">
              <input type="time" value="${scheduledTime}"
                     onchange="eventsModule.setROItemTime('${item.id}', this.value)"
                     ${this.isPublished ? 'disabled' : ''}>
              <div class="duration">${duration}m</div>
            </div>
            <div class="ro-details">
              <div class="ro-break-label">
                <i class="${breakIcon} me-1"></i>${utils.escapeHtml(awardName)}
              </div>
              ${notes ? `<div class="ro-notes-preview" title="${utils.escapeHtml(notes)}"><i class="bi bi-sticky me-1"></i>${utils.escapeHtml(notes)}</div>` : ''}
            </div>
            <div class="ro-sponsor"></div>
            <div class="ro-recipient" style="width:120px;"></div>
            <div class="ro-status">
              <select onchange="eventsModule.setROItemStatus('${item.id}', this.value)" ${this.isPublished ? 'disabled' : ''}>
                ${statusOpts}
              </select>
            </div>
            <div class="ro-actions" style="width:140px;">
              ${!this.isPublished ? `
                <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.moveROItem('${item.id}', -1)" title="Move up" ${isFirst ? 'disabled' : ''}>
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.moveROItem('${item.id}', 1)" title="Move down" ${isLast ? 'disabled' : ''}>
                  <i class="bi bi-arrow-down"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary" onclick="eventsModule.editRunningOrderItem('${item.id}')" title="Edit">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="eventsModule.deleteRunningOrderItem('${item.id}')" title="Delete">
                  <i class="bi bi-trash"></i>
                </button>
              ` : `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Locked</span>`}
            </div>
          </div>
        </div>`;
        return;
      }

      // Determine grouping state
      const isGrouped = item.presentation_group && this.runningOrderItems.filter(
        i => i.presentation_group === item.presentation_group
      ).length > 1;
      const orgAwardCount = this._roOrgAwardCount(item);
      const isGroupStart = isGrouped && !renderedGroups.has(item.presentation_group);
      const groupMembers = isGrouped ? this.runningOrderItems.filter(i => i.presentation_group === item.presentation_group) : [];

      // Render group header if this is the first item in a group
      if (isGroupStart) {
        renderedGroups.add(item.presentation_group);
        presentationNumber++;
        const groupDuration = groupMembers.reduce((sum, m) => sum + (m.duration_minutes || 3), 0);

        html += `
        <div class="ro-group-header ${matchesSearch ? '' : 'search-hidden'}"
             draggable="${!this.isPublished}"
             data-group="${item.presentation_group}"
             data-id="${item.id}"
             ondragstart="eventsModule.handleDragStart(event)"
             ondragover="eventsModule.handleDragOver(event)"
             ondragleave="eventsModule.handleDragLeave(event)"
             ondrop="eventsModule.handleDrop(event)"
             ondragend="eventsModule.handleDragEnd(event)"
             ontouchstart="eventsModule.handleTouchStart(event)"
             ontouchmove="eventsModule.handleTouchMove(event)"
             ontouchend="eventsModule.handleTouchEnd(event)">
          <div class="d-flex align-items-center gap-2 py-2 px-2">
            ${!this.isPublished ? `<div class="ro-drag-handle" title="Drag group to reorder"><i class="bi bi-grip-vertical"></i></div>` : '<div style="width:32px;"></div>'}
            <div class="ro-number">${presentationNumber}<span class="sub">GROUP</span></div>
            <div class="ro-time">
              <input type="time" value="${groupMembers[0]?.scheduled_time || ''}"
                     onchange="eventsModule.setROItemTime('${item.id}', this.value)"
                     ${this.isPublished ? 'disabled' : ''}>
              <div class="duration">${groupDuration}m</div>
            </div>
            <div class="ro-details">
              <div class="ro-award-name">
                <i class="bi bi-collection me-1"></i>${utils.escapeHtml(winnerName)}
                <span class="badge bg-info ms-2" style="font-size:0.65rem;">${groupMembers.length} awards together</span>
              </div>
              <div class="ro-winner-name" style="font-size:0.75rem; color:#6c757d;">
                ${groupMembers.map(m => utils.escapeHtml(m.award_name || 'Award')).join(' &bull; ')}
              </div>
            </div>
            <div class="ro-sponsor">
              ${sponsor ? `<span title="${utils.escapeHtml(sponsor)}"><i class="bi bi-star-fill me-1" style="color:#ffc107; font-size:0.6rem;"></i>${utils.escapeHtml(sponsor)}</span>` : ''}
            </div>
            <div class="ro-recipient" style="width:120px;">
              <small class="text-muted" style="font-size:0.65rem;">Collecting:</small>
              <strong>${utils.escapeHtml(recipientName)}</strong>
            </div>
            <div class="ro-status">
              <select onchange="eventsModule.setROItemStatus('${item.id}', this.value)" ${this.isPublished ? 'disabled' : ''}>
                ${statusOpts}
              </select>
            </div>
            <div class="ro-actions" style="width:140px;">
              ${!this.isPublished ? `
                <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.moveROItem('${item.id}', -1)" title="Move group up" ${isFirst ? 'disabled' : ''}>
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.moveROItem('${item.id}', 1)" title="Move group down" ${isLast ? 'disabled' : ''}>
                  <i class="bi bi-arrow-down"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="eventsModule.splitAllPresentation('${item.id}')" title="Split all into separate presentations">
                  <i class="bi bi-scissors"></i>
                </button>
              ` : `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Locked</span>`}
            </div>
          </div>
        </div>`;
      }

      // For grouped items, render as sub-items under the group header
      if (isGrouped) {
        html += `
        <div class="ro-item ro-grouped-item ${this.isPublished ? 'published' : ''} ${status !== 'pending' ? 'status-' + status : ''} ${matchesSearch ? '' : 'search-hidden'}"
             data-id="${item.id}" data-index="${index}" data-group="${item.presentation_group}">
          <div class="d-flex align-items-center gap-2 py-1 px-2">
            <div style="width:32px;"></div>
            <div class="ro-number" style="font-size:0.9rem; color:#adb5bd;">
              ${presentationNumber}.${groupMembers.indexOf(item) + 1}
            </div>
            <div style="width:70px;"></div>
            <div class="ro-details">
              <div class="ro-award-name" style="font-size:0.82rem;" title="${utils.escapeHtml(awardName)}">
                <i class="bi bi-trophy me-1" style="color:#ffc107;"></i>${utils.escapeHtml(awardName)}
              </div>
              ${notes ? `<div class="ro-notes-preview" title="${utils.escapeHtml(notes)}"><i class="bi bi-sticky me-1"></i>${utils.escapeHtml(notes)}</div>` : ''}
            </div>
            <div class="ro-sponsor"></div>
            <div class="ro-recipient" style="width:120px;"></div>
            <div class="ro-status"></div>
            <div class="ro-actions" style="width:140px;">
              ${!this.isPublished ? `
                <button class="btn btn-sm btn-outline-primary" onclick="eventsModule.editRunningOrderItem('${item.id}')" title="Edit">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="eventsModule.splitPresentation('${item.id}')" title="Split into separate presentation">
                  <i class="bi bi-box-arrow-right"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="eventsModule.deleteRunningOrderItem('${item.id}')" title="Delete">
                  <i class="bi bi-trash"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>`;
        return; // Don't render as a normal row
      }

      // Non-grouped award item (standalone)
      presentationNumber++;
      html += `
      <div class="ro-item ${this.isPublished ? 'published' : ''} ${status !== 'pending' ? 'status-' + status : ''} ${matchesSearch ? '' : 'search-hidden'}"
           draggable="${!this.isPublished}"
           data-id="${item.id}"
           data-index="${index}"
           ondragstart="eventsModule.handleDragStart(event)"
           ondragover="eventsModule.handleDragOver(event)"
           ondragleave="eventsModule.handleDragLeave(event)"
           ondrop="eventsModule.handleDrop(event)"
           ondragend="eventsModule.handleDragEnd(event)"
           ontouchstart="eventsModule.handleTouchStart(event)"
           ontouchmove="eventsModule.handleTouchMove(event)"
           ontouchend="eventsModule.handleTouchEnd(event)">
        <div class="d-flex align-items-center gap-2 py-2 px-2">
          ${!this.isPublished ? `<div class="ro-drag-handle" title="Drag to reorder"><i class="bi bi-grip-vertical"></i></div>` : '<div style="width:32px;"></div>'}
          <div class="ro-number">
            ${presentationNumber}
            <span class="sub">${item.award_number || ''}</span>
          </div>
          <div class="ro-time">
            <input type="time" value="${scheduledTime}"
                   onchange="eventsModule.setROItemTime('${item.id}', this.value)"
                   ${this.isPublished ? 'disabled' : ''}
                   title="Scheduled time">
            <div class="duration" title="Cumulative: ${cumTime} min">${duration}m ${scheduleIndicator}</div>
          </div>
          <div class="ro-details">
            <div class="ro-award-name" title="${utils.escapeHtml(awardName)}">
              ${utils.escapeHtml(awardName)}
              ${item.table_number ? `<span class="badge bg-secondary ms-1" style="font-size:0.55rem; vertical-align:middle;" title="Table ${item.table_number}"><i class="bi bi-geo-alt"></i> T${item.table_number}</span>` : ''}
              ${item.cue_notes ? `<span class="badge bg-info ms-1" style="font-size:0.55rem; vertical-align:middle;" title="${utils.escapeHtml(item.cue_notes)}"><i class="bi bi-lightning"></i> CUE</span>` : ''}
            </div>
            <div class="ro-winner-name" title="${utils.escapeHtml(winnerName)}">${utils.escapeHtml(winnerName)}</div>
            ${notes ? `<div class="ro-notes-preview" title="${utils.escapeHtml(notes)}"><i class="bi bi-sticky me-1"></i>${utils.escapeHtml(notes)}</div>` : ''}
          </div>
          <div class="ro-sponsor">
            ${sponsor ? `<span title="${utils.escapeHtml(sponsor)}"><i class="bi bi-star-fill me-1" style="color:#ffc107; font-size:0.6rem;"></i>${utils.escapeHtml(sponsor)}</span>` : ''}
          </div>
          <div class="ro-recipient" style="width:120px;">
            <small class="text-muted" style="font-size:0.65rem;">Collecting:</small>
            <strong title="${utils.escapeHtml(recipientName)}">${utils.escapeHtml(recipientName)}</strong>
          </div>
          <div class="ro-status">
            <select onchange="eventsModule.setROItemStatus('${item.id}', this.value)" ${this.isPublished ? 'disabled' : ''}>
              ${statusOpts}
            </select>
          </div>
          <div class="ro-actions" style="width:140px;">
            ${!this.isPublished ? `
              <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.moveROItem('${item.id}', -1)" title="Move up" ${isFirst ? 'disabled' : ''}>
                <i class="bi bi-arrow-up"></i>
              </button>
              <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.moveROItem('${item.id}', 1)" title="Move down" ${isLast ? 'disabled' : ''}>
                <i class="bi bi-arrow-down"></i>
              </button>
              <button class="btn btn-sm btn-outline-primary" onclick="eventsModule.editRunningOrderItem('${item.id}')" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.duplicateROItem('${item.id}')" title="Duplicate">
                <i class="bi bi-copy"></i>
              </button>
              ${orgAwardCount > 1 && !isGrouped ? `
              <button class="btn btn-sm btn-outline-info" onclick="eventsModule.groupPresentation('${item.id}')" title="Group all awards for this org into one presentation">
                <i class="bi bi-collection"></i>
              </button>` : ''}
              <button class="btn btn-sm btn-outline-danger" onclick="eventsModule.deleteRunningOrderItem('${item.id}')" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            ` : `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Locked</span>`}
          </div>
        </div>
      </div>`;
    });

    container.innerHTML = html;

    // Update total badge and presentation count
    const totalBadge = document.querySelector('#runningOrderModal .badge.bg-secondary');
    if (totalBadge) totalBadge.textContent = `${this.runningOrderItems.length} items, ${presentationNumber} presentations`;

    // Update undo button state
    const undoBtn = document.getElementById('roUndoBtn');
    if (undoBtn) undoBtn.disabled = this._roUndoStack.length === 0;

    // Update overall schedule indicator
    this._roUpdateOverallSchedule();
  },

  // ============================================
  // MOVE UP/DOWN
  // ============================================
  moveROItem(itemId, direction) {
    if (this.isPublished) return;
    const idx = this.runningOrderItems.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= this.runningOrderItems.length) return;

    // Save undo state
    this._roPushUndo();

    // Swap
    const temp = this.runningOrderItems[idx];
    this.runningOrderItems[idx] = this.runningOrderItems[newIdx];
    this.runningOrderItems[newIdx] = temp;

    // Recalculate order numbers
    this._roRecalcNumbers();
    this.renderRunningOrderItems();

    // Scroll moved item into view
    setTimeout(() => {
      const el = document.querySelector(`.ro-item[data-id="${itemId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);

    if (this._roAutoSave) this._roAutoSaveDebounced();
  },

  // ============================================
  // DRAG AND DROP (Enhanced)
  // ============================================
  handleDragStart(event) {
    if (this.isPublished) return;
    const item = event.currentTarget;
    this.draggedItemId = item.dataset.id;
    item.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.dataset.id);
    // Save undo state before drag
    this._roPushUndo();
  },

  handleDragOver(event) {
    if (this.isPublished) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const target = event.currentTarget;
    if (target.classList.contains('dragging')) return;

    const draggable = document.querySelector('.ro-item.dragging');
    if (!draggable) return;

    const container = target.parentElement;
    const afterElement = this.getDragAfterElement(container, event.clientY);

    if (afterElement == null) {
      container.appendChild(draggable);
    } else {
      container.insertBefore(draggable, afterElement);
    }
  },

  handleDragLeave(event) {
    // No-op, visual cleanup handled by dragEnd
  },

  handleDrop(event) {
    if (this.isPublished) return;
    event.preventDefault();
  },

  handleDragEnd(event) {
    if (this.isPublished) return;
    event.currentTarget.classList.remove('dragging');
    // Remove any drag-over styles
    document.querySelectorAll('.ro-item').forEach(el => el.classList.remove('drag-placeholder'));
    this.updateOrderFromDOM();
    if (this._roAutoSave) this._roAutoSaveDebounced();
  },

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.ro-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  },

  // ============================================
  // TOUCH SUPPORT FOR MOBILE DRAG
  // ============================================
  handleTouchStart(event) {
    if (this.isPublished) return;
    const touch = event.touches[0];
    this._roTouchStartY = touch.clientY;
    this._roTouchItem = event.currentTarget;
    this._roTouchItem._touchTimeout = setTimeout(() => {
      this._roTouchItem.classList.add('dragging');
      this._roPushUndo();
    }, 200);
  },

  handleTouchMove(event) {
    if (this.isPublished || !this._roTouchItem) return;
    if (!this._roTouchItem.classList.contains('dragging')) {
      clearTimeout(this._roTouchItem._touchTimeout);
      return;
    }
    event.preventDefault();
    const touch = event.touches[0];
    const container = document.getElementById('runningOrderList');
    if (!container) return;

    const afterElement = this.getDragAfterElement(container, touch.clientY);
    if (afterElement == null) {
      container.appendChild(this._roTouchItem);
    } else {
      container.insertBefore(this._roTouchItem, afterElement);
    }
  },

  handleTouchEnd(event) {
    if (this.isPublished || !this._roTouchItem) return;
    clearTimeout(this._roTouchItem._touchTimeout);
    if (this._roTouchItem.classList.contains('dragging')) {
      this._roTouchItem.classList.remove('dragging');
      this.updateOrderFromDOM();
      if (this._roAutoSave) this._roAutoSaveDebounced();
    }
    this._roTouchItem = null;
  },

  // ============================================
  // UPDATE ORDER FROM DOM
  // ============================================
  updateOrderFromDOM() {
    const items = document.querySelectorAll('.ro-item');
    const newOrder = [];
    items.forEach((item, index) => {
      const id = item.dataset.id;
      const orderItem = this.runningOrderItems.find(i => i.id === id);
      if (orderItem) {
        orderItem.display_order = index + 1;
        orderItem.award_number = `${orderItem.section || 1}-${String(index + 1).padStart(2, '0')}`;
        newOrder.push(orderItem);
      }
    });
    this.runningOrderItems = newOrder;
    this.renderRunningOrderItems();
  },

  // ============================================
  // RECALC NUMBERS
  // ============================================
  _roRecalcNumbers() {
    this.runningOrderItems.forEach((item, index) => {
      item.display_order = index + 1;
      item.award_number = `${item.section || 1}-${String(index + 1).padStart(2, '0')}`;
    });
  },

  // ============================================
  // UNDO REORDER
  // ============================================
  _roPushUndo() {
    this._roUndoStack.push(this.runningOrderItems.map(i => ({ ...i })));
    if (this._roUndoStack.length > 20) this._roUndoStack.shift();
    const undoBtn = document.getElementById('roUndoBtn');
    if (undoBtn) undoBtn.disabled = false;
  },

  undoROReorder() {
    if (this._roUndoStack.length === 0) return;
    this.runningOrderItems = this._roUndoStack.pop();
    this.renderRunningOrderItems();
    utils.showToast('Reorder undone', 'info');
  },

  // ============================================
  // SEARCH WITHIN RUNNING ORDER
  // ============================================
  searchRunningOrder(term) {
    this._roSearchTerm = term;
    const search = term.toLowerCase();
    document.querySelectorAll('.ro-item').forEach(el => {
      const id = el.dataset.id;
      const item = this.runningOrderItems.find(i => i.id === id);
      if (!item) return;
      const haystack = `${item.award_name || ''} ${item.display_name || ''} ${item.recipient_collecting || ''} ${item.notes || ''}`.toLowerCase();
      el.classList.toggle('search-hidden', search.length > 0 && !haystack.includes(search));
    });
  },

  // ============================================
  // SET ITEM STATUS INLINE
  // ============================================
  async setROItemStatus(itemId, newStatus) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item) return;
    item.status = newStatus;
    // Update actual_time when announced/completed
    if (newStatus === 'announced' || newStatus === 'completed') {
      item.actual_time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    try {
      await STATE.client.from('running_order').update({ status: newStatus, actual_time: item.actual_time || null }).eq('id', itemId);
    } catch (error) {
      console.error('Error updating status:', error);
    }
    this.renderRunningOrderItems();
  },

  // ============================================
  // SET ITEM TIME INLINE
  // ============================================
  async setROItemTime(itemId, time) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item) return;
    item.scheduled_time = time;
    try {
      await STATE.client.from('running_order').update({ scheduled_time: time || null }).eq('id', itemId);
    } catch (error) {
      console.error('Error updating time:', error);
    }
  },

  // ============================================
  // AUTO-SAVE DEBOUNCED
  // ============================================
  _roAutoSaveTimer: null,
  _roAutoSaveDebounced() {
    clearTimeout(this._roAutoSaveTimer);
    this._roAutoSaveTimer = setTimeout(() => this.saveRunningOrder(), 1500);
  },

  // ============================================
  // SECTION BREAKS & NON-AWARD ITEMS
  // ============================================

  /**
   * Add a section break / non-award item
   */
  addSectionBreak() {
    const eventId = this.currentEventIdRunningOrder;
    if (!eventId) { utils.showToast('No event selected', 'warning'); return; }

    const modalHtml = `
      <div class="modal fade" id="addSectionBreakModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header" style="background: linear-gradient(135deg, #7e57c2, #5e35b1); color: white;">
              <h5 class="modal-title"><i class="bi bi-dash-lg me-2"></i>Add Section Break</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="addSectionBreakForm">
                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Type</label>
                    <select class="form-select" id="breakType">
                      <option value="break">Break / Pause</option>
                      <option value="speech">Speech</option>
                      <option value="entertainment">Entertainment</option>
                      <option value="interval">Interval / Dinner</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Scheduled Time</label>
                    <input type="time" class="form-control" id="breakScheduledTime">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Duration (min)</label>
                    <input type="number" class="form-control" id="breakDuration" value="15" min="1" max="120">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Title <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="breakTitle" required placeholder="e.g. Dinner Service, Guest Speaker, Interval">
                </div>
                <div class="mb-3">
                  <label class="form-label">Notes</label>
                  <textarea class="form-control" id="breakNotes" rows="2" placeholder="Details, instructions..."></textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn text-white" style="background:#7e57c2;" onclick="eventsModule.saveSectionBreak()">
                <i class="bi bi-plus-circle me-2"></i>Add to Running Order
              </button>
            </div>
          </div>
        </div>
      </div>`;

    const existingModal = document.getElementById('addSectionBreakModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('addSectionBreakModal'));
    modal.show();
    document.getElementById('addSectionBreakModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
  },

  /**
   * Save section break to database
   */
  async saveSectionBreak() {
    const title = document.getElementById('breakTitle').value.trim();
    if (!title) {
      utils.showToast('Please enter a title', 'warning');
      return;
    }

    const nextOrder = this.runningOrderItems.length + 1;
    const section = this.runningOrderItems.length > 0
      ? (this.runningOrderItems[this.runningOrderItems.length - 1].section || 1)
      : 1;

    const entryData = {
      event_id: this.currentEventIdRunningOrder,
      award_number: `${section}-${String(nextOrder).padStart(2, '0')}`,
      display_order: nextOrder,
      section: section,
      award_name: title,
      display_name: title,
      item_type: document.getElementById('breakType').value || 'break',
      scheduled_time: document.getElementById('breakScheduledTime').value || null,
      duration_minutes: parseInt(document.getElementById('breakDuration').value) || 15,
      notes: document.getElementById('breakNotes').value.trim() || null,
      status: 'pending'
    };

    try {
      const { error } = await STATE.client.from('running_order').insert([entryData]);
      if (error) throw error;
      utils.showToast('Section break added', 'success');
      bootstrap.Modal.getInstance(document.getElementById('addSectionBreakModal')).hide();
      await this.loadRunningOrder();
      this.renderRunningOrderItems();
    } catch (error) {
      console.error('Error adding section break:', error);
      utils.showToast('Failed to add section break: ' + error.message, 'error');
    }
  },

  // ============================================
  // AUTO-SCHEDULE TIMES
  // ============================================

  /**
   * Set ceremony start time
   */
  async setCeremonyStartTime(time) {
    this._roCeremonyStartTime = time || null;
    try {
      await STATE.client
        .from('running_order_settings')
        .upsert({
          event_id: this.currentEventIdRunningOrder,
          ceremony_start_time: time || null,
          auto_schedule: this._roAutoSchedule
        }, { onConflict: 'event_id' });
    } catch (error) {
      console.error('Error saving ceremony start time:', error);
    }
    if (this._roAutoSchedule && time) {
      this.recalcAutoSchedule();
    }
  },

  /**
   * Toggle auto-schedule mode
   */
  async toggleAutoSchedule(enabled) {
    this._roAutoSchedule = enabled;
    try {
      await STATE.client
        .from('running_order_settings')
        .upsert({
          event_id: this.currentEventIdRunningOrder,
          ceremony_start_time: this._roCeremonyStartTime,
          auto_schedule: enabled
        }, { onConflict: 'event_id' });
    } catch (error) {
      console.error('Error saving auto-schedule setting:', error);
    }
    if (enabled && this._roCeremonyStartTime) {
      this.recalcAutoSchedule();
    } else {
      // Refresh modal to show/hide recalc button
      document.getElementById('runningOrderModal').remove();
      this.createRunningOrderModal();
    }
  },

  /**
   * Recalculate all scheduled times based on ceremony start time and durations
   */
  async recalcAutoSchedule() {
    if (!this._roCeremonyStartTime) {
      utils.showToast('Set a ceremony start time first', 'warning');
      return;
    }

    // Parse start time
    const [startH, startM] = this._roCeremonyStartTime.split(':').map(Number);
    let currentMinutes = startH * 60 + startM;

    // Walk through items and assign times
    for (const item of this.runningOrderItems) {
      const hours = Math.floor(currentMinutes / 60) % 24;
      const mins = currentMinutes % 60;
      item.scheduled_time = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      currentMinutes += (item.duration_minutes || 3);
    }

    // Save to DB
    try {
      for (const item of this.runningOrderItems) {
        await STATE.client.from('running_order')
          .update({ scheduled_time: item.scheduled_time })
          .eq('id', item.id);
      }
      utils.showToast('Times auto-scheduled from ' + this._roCeremonyStartTime, 'success');
    } catch (error) {
      console.error('Error auto-scheduling:', error);
      utils.showToast('Failed to auto-schedule: ' + error.message, 'error');
    }

    this.renderRunningOrderItems();
  },

  // ============================================
  // DUPLICATE ITEM
  // ============================================

  /**
   * Duplicate a running order item
   */
  async duplicateROItem(itemId) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item) return;

    const nextOrder = this.runningOrderItems.length + 1;
    const section = item.section || 1;

    const newEntry = {
      event_id: this.currentEventIdRunningOrder,
      award_number: `${section}-${String(nextOrder).padStart(2, '0')}`,
      display_order: item.display_order + 1,
      award_name: item.award_name ? item.award_name + ' (copy)' : null,
      display_name: item.display_name || null,
      recipient_collecting: item.recipient_collecting || null,
      scheduled_time: null,
      duration_minutes: item.duration_minutes || 3,
      item_type: item.item_type || 'award',
      sponsor: item.sponsor || null,
      cue_notes: item.cue_notes || null,
      table_number: item.table_number || null,
      notes: item.notes || null,
      special_requirements: item.special_requirements || null,
      status: 'pending',
      section: section
    };

    try {
      const { error } = await STATE.client.from('running_order').insert([newEntry]);
      if (error) throw error;
      utils.showToast('Item duplicated', 'success');
      await this.loadRunningOrder();
      this._roRecalcNumbers();
      await this.saveRunningOrder();
      this.renderRunningOrderItems();
      if (this._roAutoSchedule && this._roCeremonyStartTime) {
        this.recalcAutoSchedule();
      }
    } catch (error) {
      console.error('Error duplicating item:', error);
      utils.showToast('Failed to duplicate: ' + error.message, 'error');
    }
  },

  // ============================================
  // BEHIND/AHEAD SCHEDULE TRACKING
  // ============================================

  /**
   * Get schedule indicator for a single item (comparing actual_time vs scheduled_time)
   */
  _roGetItemScheduleIndicator(item) {
    if (!item.actual_time || !item.scheduled_time) return '';
    const scheduled = this._roTimeToMinutes(item.scheduled_time);
    const actual = this._roTimeToMinutes(item.actual_time);
    if (scheduled === null || actual === null) return '';

    const diff = actual - scheduled;
    if (Math.abs(diff) <= 1) return '<span class="schedule-on-time" title="On time">&#10003;</span>';
    if (diff > 0) return `<span class="schedule-behind" title="${diff} min behind">+${diff}m</span>`;
    return `<span class="schedule-ahead" title="${Math.abs(diff)} min ahead">${diff}m</span>`;
  },

  /**
   * Parse time string "HH:MM" to total minutes
   */
  _roTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  },

  /**
   * Update the overall schedule indicator in the stats bar
   */
  _roUpdateOverallSchedule() {
    const indicator = document.getElementById('roScheduleIndicator');
    if (!indicator) return;

    // Find the most recently completed item that has both times
    const completedWithTimes = this.runningOrderItems.filter(
      i => (i.status === 'completed' || i.status === 'announced') && i.actual_time && i.scheduled_time
    );

    if (completedWithTimes.length === 0) {
      indicator.innerHTML = '';
      return;
    }

    const lastCompleted = completedWithTimes[completedWithTimes.length - 1];
    const scheduled = this._roTimeToMinutes(lastCompleted.scheduled_time);
    const actual = this._roTimeToMinutes(lastCompleted.actual_time);

    if (scheduled === null || actual === null) {
      indicator.innerHTML = '';
      return;
    }

    const diff = actual - scheduled;
    if (Math.abs(diff) <= 1) {
      indicator.innerHTML = '<span class="badge bg-success"><i class="bi bi-clock me-1"></i>On Schedule</span>';
    } else if (diff > 0) {
      indicator.innerHTML = `<span class="badge bg-danger"><i class="bi bi-clock me-1"></i>${diff} min behind</span>`;
    } else {
      indicator.innerHTML = `<span class="badge bg-info"><i class="bi bi-clock me-1"></i>${Math.abs(diff)} min ahead</span>`;
    }
  },

  // ============================================
  // BACKSTAGE / STAGE MANAGER VIEW
  // ============================================

  /**
   * Open full-screen backstage view for production team
   */
  openBackstageView() {
    const items = this.runningOrderItems;
    if (items.length === 0) {
      utils.showToast('No items in running order', 'warning');
      return;
    }

    // Find current item (first non-completed item)
    let currentIdx = items.findIndex(i => i.status !== 'completed');
    if (currentIdx === -1) currentIdx = items.length - 1;

    const backstageHtml = this._buildBackstageHtml(currentIdx);

    const existingModal = document.getElementById('backstageViewModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', backstageHtml);

    const modal = new bootstrap.Modal(document.getElementById('backstageViewModal'));
    modal.show();

    // Store current index for navigation
    this._backstageCurrentIdx = currentIdx;

    // Start auto-refresh
    this._roBackstageInterval = setInterval(() => this._refreshBackstageView(), 5000);

    document.getElementById('backstageViewModal').addEventListener('hidden.bs.modal', () => {
      clearInterval(this._roBackstageInterval);
      document.getElementById('backstageViewModal').remove();
    });

    // Keyboard shortcuts
    document.getElementById('backstageViewModal').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); this.backstageNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.backstagePrev(); }
    });
  },

  _backstageCurrentIdx: 0,

  /**
   * Build backstage view HTML
   */
  _buildBackstageHtml(currentIdx) {
    const items = this.runningOrderItems;
    const current = items[currentIdx];
    const next = items[currentIdx + 1] || null;
    const prev = items[currentIdx - 1] || null;

    const completedCount = items.filter(i => i.status === 'completed').length;
    const totalCount = items.length;
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Schedule tracking
    let scheduleStatus = '';
    const completedWithTimes = items.filter(i => (i.status === 'completed' || i.status === 'announced') && i.actual_time && i.scheduled_time);
    if (completedWithTimes.length > 0) {
      const last = completedWithTimes[completedWithTimes.length - 1];
      const scheduled = this._roTimeToMinutes(last.scheduled_time);
      const actual = this._roTimeToMinutes(last.actual_time);
      if (scheduled !== null && actual !== null) {
        const diff = actual - scheduled;
        if (Math.abs(diff) <= 1) {
          scheduleStatus = '<span style="color:#4caf50; font-size:1.2rem;">ON SCHEDULE</span>';
        } else if (diff > 0) {
          scheduleStatus = `<span style="color:#f44336; font-size:1.2rem;">${diff} MIN BEHIND</span>`;
        } else {
          scheduleStatus = `<span style="color:#2196f3; font-size:1.2rem;">${Math.abs(diff)} MIN AHEAD</span>`;
        }
      }
    }

    const currentItemType = current?.item_type || 'award';
    const currentIsBreak = currentItemType !== 'award';
    const currentIcon = currentIsBreak ? this._getBreakIcon(currentItemType) : 'bi-trophy-fill';

    const nextItemType = next?.item_type || 'award';
    const nextIsBreak = nextItemType !== 'award';
    const nextIcon = nextIsBreak ? this._getBreakIcon(nextItemType) : 'bi-trophy';

    return `
      <div class="modal fade" id="backstageViewModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-fullscreen">
          <div class="modal-content" style="background:#1a1a2e; color:#eee;">
            <!-- Top Bar -->
            <div class="d-flex justify-content-between align-items-center px-4 py-2" style="background:#16213e; border-bottom:2px solid #0f3460;">
              <div>
                <h5 class="mb-0" style="color:#e94560;">
                  <i class="bi bi-display me-2"></i>BACKSTAGE - ${utils.escapeHtml(this.currentEventName)}
                </h5>
              </div>
              <div class="d-flex align-items-center gap-4">
                ${scheduleStatus}
                <span style="color:#aaa; font-size:1rem;">
                  <i class="bi bi-clock me-1"></i>
                  <span id="backstageClock">${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </span>
                <div style="color:#aaa;">
                  ${completedCount}/${totalCount} complete (${progressPct}%)
                </div>
                <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
                  <i class="bi bi-x-lg me-1"></i>Exit
                </button>
              </div>
            </div>

            <!-- Progress Bar -->
            <div style="height:4px; background:#0f3460;">
              <div style="height:100%; width:${progressPct}%; background: linear-gradient(90deg, #e94560, #0f3460); transition: width 0.5s;"></div>
            </div>

            <!-- Main Content -->
            <div class="d-flex flex-column justify-content-center align-items-center flex-grow-1 px-4" style="min-height:0;">

              <!-- Current Item - Large -->
              <div class="text-center mb-4" style="max-width:900px; width:100%;">
                <div class="mb-2" style="color:#e94560; text-transform:uppercase; letter-spacing:3px; font-size:0.85rem;">
                  ${current?.status === 'announced' ? '<i class="bi bi-broadcast me-1"></i>NOW PRESENTING' : '<i class="bi bi-arrow-right-circle me-1"></i>CURRENT'}
                </div>
                <div class="p-4 rounded-3" style="background:#16213e; border:2px solid #0f3460;">
                  <div style="font-size:1rem; color:#aaa; margin-bottom:8px;">
                    <i class="bi ${currentIcon} me-1"></i>
                    #${currentIdx + 1} ${current?.scheduled_time ? `| ${current.scheduled_time}` : ''} ${current?.sponsor ? `| Sponsored by ${utils.escapeHtml(current.sponsor)}` : ''}
                  </div>
                  <div style="font-size:2.5rem; font-weight:700; color:#fff; line-height:1.2; margin-bottom:12px;">
                    ${utils.escapeHtml(current?.award_name || 'N/A')}
                  </div>
                  ${!currentIsBreak ? `
                    <div style="font-size:1.6rem; color:#4fc3f7; margin-bottom:8px;">
                      ${utils.escapeHtml(current?.display_name || '')}
                    </div>
                    ${current?.recipient_collecting ? `
                      <div style="font-size:1.1rem; color:#aaa;">
                        <i class="bi bi-person me-1"></i>Collecting: <strong style="color:#fff;">${utils.escapeHtml(current.recipient_collecting)}</strong>
                        ${current.table_number ? `<span style="margin-left:16px; color:#aaa;"><i class="bi bi-geo-alt me-1"></i>Table ${current.table_number}</span>` : ''}
                      </div>
                    ` : ''}
                  ` : ''}
                  ${current?.cue_notes ? `
                    <div style="font-size:0.9rem; color:#4fc3f7; margin-top:10px; padding-top:10px; border-top:1px solid #0f3460; font-family:monospace;">
                      <i class="bi bi-lightning-fill me-1" style="color:#ffc107;"></i>CUE: ${utils.escapeHtml(current.cue_notes)}
                    </div>
                  ` : ''}
                  ${current?.notes ? `
                    <div style="font-size:0.9rem; color:#888; margin-top:6px; ${!current.cue_notes ? 'padding-top:10px; border-top:1px solid #0f3460;' : ''}">
                      <i class="bi bi-sticky me-1"></i>${utils.escapeHtml(current.notes)}
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- Next Item Preview -->
              ${next ? `
              <div class="text-center" style="max-width:700px; width:100%; opacity:0.7;">
                <div class="mb-1" style="color:#aaa; text-transform:uppercase; letter-spacing:2px; font-size:0.75rem;">
                  <i class="bi bi-skip-forward me-1"></i>UP NEXT
                </div>
                <div class="p-3 rounded-3" style="background:#16213e50; border:1px solid #0f346050;">
                  <div style="font-size:0.85rem; color:#666; margin-bottom:4px;">
                    <i class="bi ${nextIcon} me-1"></i>
                    #${currentIdx + 2} ${next.scheduled_time ? `| ${next.scheduled_time}` : ''} ${next.sponsor ? `| Sponsored by ${utils.escapeHtml(next.sponsor)}` : ''}
                  </div>
                  <div style="font-size:1.4rem; font-weight:600; color:#ccc;">
                    ${utils.escapeHtml(next.award_name || 'N/A')}
                  </div>
                  ${!nextIsBreak ? `
                    <div style="font-size:1rem; color:#4fc3f7aa;">
                      ${utils.escapeHtml(next.display_name || '')}
                      ${next.recipient_collecting ? ` - Collecting: ${utils.escapeHtml(next.recipient_collecting)}` : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
              ` : '<div style="color:#666; font-size:1.2rem;">This is the last item</div>'}
            </div>

            <!-- Bottom Navigation -->
            <div class="d-flex justify-content-between align-items-center px-4 py-3" style="background:#16213e; border-top:2px solid #0f3460;">
              <button class="btn btn-outline-light btn-lg" onclick="eventsModule.backstagePrev()" ${currentIdx === 0 ? 'disabled' : ''}>
                <i class="bi bi-arrow-left me-2"></i>Previous
              </button>
              <div class="text-center">
                <small style="color:#666;">Use <kbd style="background:#333; padding:2px 8px; border-radius:3px;">&larr;</kbd> <kbd style="background:#333; padding:2px 8px; border-radius:3px;">&rarr;</kbd> arrow keys or <kbd style="background:#333; padding:2px 8px; border-radius:3px;">Space</kbd> to navigate</small>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-warning btn-lg" onclick="eventsModule.backstageMarkStatus('announced')"
                        ${current?.status === 'announced' || current?.status === 'completed' ? 'disabled' : ''}>
                  <i class="bi bi-broadcast me-1"></i>Mark Announced
                </button>
                <button class="btn btn-success btn-lg" onclick="eventsModule.backstageMarkStatus('completed')"
                        ${current?.status === 'completed' ? 'disabled' : ''}>
                  <i class="bi bi-check-circle me-1"></i>Mark Complete
                </button>
                <button class="btn btn-primary btn-lg" onclick="eventsModule.backstageNext()" ${currentIdx >= items.length - 1 ? 'disabled' : ''}>
                  Next<i class="bi bi-arrow-right ms-2"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  },

  /**
   * Get break icon for item type
   */
  _getBreakIcon(itemType) {
    const icons = {
      'break': 'bi-cup-hot',
      'speech': 'bi-mic',
      'entertainment': 'bi-music-note-beamed',
      'interval': 'bi-pause-circle',
      'other': 'bi-bookmark'
    };
    return icons[itemType] || 'bi-bookmark';
  },

  /**
   * Navigate backstage view to next item
   */
  backstageNext() {
    if (this._backstageCurrentIdx >= this.runningOrderItems.length - 1) return;
    this._backstageCurrentIdx++;
    this._refreshBackstageContent();
  },

  /**
   * Navigate backstage view to previous item
   */
  backstagePrev() {
    if (this._backstageCurrentIdx <= 0) return;
    this._backstageCurrentIdx--;
    this._refreshBackstageContent();
  },

  /**
   * Mark current backstage item with a status
   */
  async backstageMarkStatus(newStatus) {
    const item = this.runningOrderItems[this._backstageCurrentIdx];
    if (!item) return;
    await this.setROItemStatus(item.id, newStatus);
    this._refreshBackstageContent();
  },

  /**
   * Refresh backstage content (rebuild the inner HTML)
   */
  _refreshBackstageContent() {
    const modal = document.getElementById('backstageViewModal');
    if (!modal) return;

    const newHtml = this._buildBackstageHtml(this._backstageCurrentIdx);
    // Extract just the modal-content from the new HTML
    const temp = document.createElement('div');
    temp.innerHTML = newHtml;
    const newContent = temp.querySelector('.modal-content');
    if (newContent) {
      modal.querySelector('.modal-content').innerHTML = newContent.innerHTML;
    }

    // Re-attach keyboard shortcuts
    modal.focus();
  },

  /**
   * Auto-refresh backstage view (update clock, check for status changes)
   */
  _refreshBackstageView() {
    const clockEl = document.getElementById('backstageClock');
    if (clockEl) {
      clockEl.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  },

  // ============================================
  // TAB SWITCHING
  // ============================================

  _roCurrentTab: 'main',

  switchROTab(tab) {
    this._roCurrentTab = tab;
    // Hide all tabs
    ['Main', 'Checklist', 'Cuesheet', 'Trophies', 'Versions'].forEach(t => {
      const el = document.getElementById('roTab' + t);
      if (el) el.style.display = 'none';
    });
    // Deactivate all tab links
    document.querySelectorAll('#roViewTabs .nav-link').forEach(a => a.classList.remove('active'));
    // Show selected tab
    const tabMap = { 'main': 'Main', 'checklist': 'Checklist', 'cuesheet': 'Cuesheet', 'trophies': 'Trophies', 'versions': 'Versions' };
    const el = document.getElementById('roTab' + tabMap[tab]);
    if (el) el.style.display = 'block';
    // Activate tab link
    const link = document.querySelector(`#roViewTabs [data-ro-tab="${tab}"]`);
    if (link) link.classList.add('active');
    // Render tab content
    if (tab === 'checklist') this.renderChecklistTab();
    if (tab === 'cuesheet') this.renderCueSheetTab();
    if (tab === 'trophies') this.renderTrophiesTab();
    if (tab === 'versions') this.renderVersionsTab();
  },

  // ============================================
  // REHEARSAL CHECKLIST
  // ============================================

  renderChecklistTab() {
    const container = document.getElementById('roChecklistContent');
    if (!container) return;

    const awardItems = this.runningOrderItems.filter(i => (i.item_type || 'award') === 'award');
    if (awardItems.length === 0) {
      container.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-check-circle display-4 d-block mb-2 opacity-25"></i><p>No award items to check.</p></div>';
      return;
    }

    // Calculate overall progress
    const totalChecks = awardItems.length * 4;
    const completedChecks = awardItems.reduce((sum, item) => {
      return sum + (item.checklist_trophy_ready ? 1 : 0) + (item.checklist_recipient_confirmed ? 1 : 0)
        + (item.checklist_special_reqs_handled ? 1 : 0) + (item.checklist_engraving_correct ? 1 : 0);
    }, 0);
    const progressPct = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;
    const progressColour = progressPct === 100 ? '#198754' : progressPct >= 50 ? '#ffc107' : '#dc3545';

    let html = `
      <div class="p-3 mb-3 border rounded bg-light">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>Pre-Event Readiness</strong>
          <span class="badge" style="background:${progressColour}; color:white;">${progressPct}% Complete (${completedChecks}/${totalChecks})</span>
        </div>
        <div class="ro-checklist-progress">
          <div class="ro-checklist-progress-bar" style="width:${progressPct}%; background:${progressColour};"></div>
        </div>
      </div>
      <table class="table table-sm table-hover mb-0" style="font-size:0.82rem;">
        <thead class="table-light">
          <tr>
            <th style="width:40px;">#</th>
            <th>Award / Winner</th>
            <th style="width:100px; text-align:center;">Trophy Ready</th>
            <th style="width:100px; text-align:center;">Engraving OK</th>
            <th style="width:100px; text-align:center;">Recipient Confirmed</th>
            <th style="width:100px; text-align:center;">Reqs Handled</th>
          </tr>
        </thead>
        <tbody>
    `;

    awardItems.forEach((item, idx) => {
      const awardName = item.award_name || 'TBC';
      const winnerName = item.display_name || 'TBC';
      const allChecked = item.checklist_trophy_ready && item.checklist_engraving_correct
        && item.checklist_recipient_confirmed && item.checklist_special_reqs_handled;

      html += `
        <tr style="${allChecked ? 'background:#f0fff4;' : ''}">
          <td class="text-center fw-bold">${idx + 1}</td>
          <td>
            <strong>${utils.escapeHtml(awardName)}</strong><br>
            <small class="text-primary">${utils.escapeHtml(winnerName)}</small>
            ${item.table_number ? `<br><small class="text-muted"><i class="bi bi-geo-alt me-1"></i>Table ${item.table_number}</small>` : ''}
          </td>
          <td class="text-center">
            <input type="checkbox" class="form-check-input" ${item.checklist_trophy_ready ? 'checked' : ''}
              onchange="eventsModule.updateChecklist('${item.id}', 'checklist_trophy_ready', this.checked)">
          </td>
          <td class="text-center">
            <input type="checkbox" class="form-check-input" ${item.checklist_engraving_correct ? 'checked' : ''}
              onchange="eventsModule.updateChecklist('${item.id}', 'checklist_engraving_correct', this.checked)">
          </td>
          <td class="text-center">
            <input type="checkbox" class="form-check-input" ${item.checklist_recipient_confirmed ? 'checked' : ''}
              onchange="eventsModule.updateChecklist('${item.id}', 'checklist_recipient_confirmed', this.checked)">
          </td>
          <td class="text-center">
            <input type="checkbox" class="form-check-input" ${item.checklist_special_reqs_handled ? 'checked' : ''}
              onchange="eventsModule.updateChecklist('${item.id}', 'checklist_special_reqs_handled', this.checked)">
          </td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  },

  async updateChecklist(itemId, field, value) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item) return;
    item[field] = value;
    try {
      await STATE.client.from('running_order').update({ [field]: value }).eq('id', itemId);
    } catch (error) {
      console.error('Error updating checklist:', error);
    }
    this.renderChecklistTab();
  },

  // ============================================
  // TROPHY / AWARD TRACKING
  // ============================================

  renderTrophiesTab() {
    const container = document.getElementById('roTrophiesContent');
    if (!container) return;

    const awardItems = this.runningOrderItems.filter(i => (i.item_type || 'award') === 'award');
    if (awardItems.length === 0) {
      container.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-trophy display-4 d-block mb-2 opacity-25"></i><p>No award items to track.</p></div>';
      return;
    }

    const statuses = [
      { key: 'not_started', label: 'Not Started', colour: '#6c757d', icon: 'bi-circle' },
      { key: 'ordered', label: 'Ordered', colour: '#0d6efd', icon: 'bi-cart-check' },
      { key: 'engraved', label: 'Engraved', colour: '#6f42c1', icon: 'bi-pen' },
      { key: 'checked', label: 'Checked', colour: '#fd7e14', icon: 'bi-check-circle' },
      { key: 'backstage_ready', label: 'Backstage Ready', colour: '#198754', icon: 'bi-check2-all' }
    ];

    // Summary counts
    const counts = {};
    statuses.forEach(s => counts[s.key] = 0);
    awardItems.forEach(i => counts[i.trophy_status || 'not_started']++);

    let html = `
      <div class="d-flex gap-2 p-3 mb-3 border rounded bg-light flex-wrap">
        ${statuses.map(s => `
          <span class="badge" style="background:${s.colour}; font-size:0.75rem;">
            <i class="${s.icon} me-1"></i>${s.label}: ${counts[s.key]}
          </span>
        `).join('')}
      </div>
      <table class="table table-sm table-hover mb-0" style="font-size:0.82rem;">
        <thead class="table-light">
          <tr>
            <th style="width:40px;">#</th>
            <th>Award</th>
            <th>Winner</th>
            <th>Collecting</th>
            <th style="width:160px;">Trophy Status</th>
          </tr>
        </thead>
        <tbody>
    `;

    awardItems.forEach((item, idx) => {
      const currentStatus = item.trophy_status || 'not_started';
      const statusInfo = statuses.find(s => s.key === currentStatus) || statuses[0];
      const opts = statuses.map(s =>
        `<option value="${s.key}" ${s.key === currentStatus ? 'selected' : ''}>${s.label}</option>`
      ).join('');

      html += `
        <tr>
          <td class="text-center fw-bold">${idx + 1}</td>
          <td><strong>${utils.escapeHtml(item.award_name || 'TBC')}</strong></td>
          <td>${utils.escapeHtml(item.display_name || 'TBC')}</td>
          <td>${utils.escapeHtml(item.recipient_collecting || 'TBC')}</td>
          <td>
            <select class="form-select form-select-sm" style="font-size:0.75rem; border-color:${statusInfo.colour};"
                    onchange="eventsModule.updateTrophyStatus('${item.id}', this.value)">
              ${opts}
            </select>
          </td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  },

  async updateTrophyStatus(itemId, status) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item) return;
    item.trophy_status = status;
    try {
      await STATE.client.from('running_order').update({ trophy_status: status }).eq('id', itemId);
      utils.showToast('Trophy status updated', 'success');
    } catch (error) {
      console.error('Error updating trophy status:', error);
    }
    this.renderTrophiesTab();
  },

  // ============================================
  // CUE SHEET / AV NOTES
  // ============================================

  renderCueSheetTab() {
    const container = document.getElementById('roCueSheetContent');
    if (!container) return;

    const items = this.runningOrderItems;
    if (items.length === 0) {
      container.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-camera-reels display-4 d-block mb-2 opacity-25"></i><p>No items in running order.</p></div>';
      return;
    }

    const itemsWithCues = items.filter(i => i.cue_notes);
    let html = `
      <div class="p-3 mb-3 border rounded bg-light d-flex justify-content-between align-items-center">
        <div>
          <strong>AV / Lighting Cue Sheet</strong>
          <span class="ms-2 text-muted small">${itemsWithCues.length} items with cues out of ${items.length} total</span>
        </div>
        <button class="btn btn-sm btn-outline-dark" onclick="eventsModule.printCueSheet()">
          <i class="bi bi-printer me-1"></i>Print Cue Sheet
        </button>
      </div>
    `;

    let presNum = 0;
    items.forEach((item, idx) => {
      const isBreak = (item.item_type || 'award') !== 'award';
      if (!isBreak) presNum++;
      const awardName = item.award_name || 'TBC';
      const cueNotes = item.cue_notes || '';
      const time = item.scheduled_time || '';
      const hasCue = !!cueNotes;

      html += `
        <div class="ro-cue-item ${!hasCue ? 'opacity-50' : ''}">
          <div class="d-flex align-items-start gap-3">
            <div style="width:35px; text-align:center; font-weight:700; color:${isBreak ? '#7e57c2' : '#ffc107'};">
              ${isBreak ? '<i class="bi bi-' + (this._getBreakIcon(item.item_type)) + '"></i>' : presNum}
            </div>
            <div style="width:55px; font-size:0.78rem; color:#666;">${time}</div>
            <div class="flex-grow-1">
              <div style="font-weight:600; font-size:0.85rem;">${utils.escapeHtml(awardName)}</div>
              ${hasCue ? `<div class="ro-cue-notes-text"><i class="bi bi-lightning-fill me-1" style="color:#ffc107;"></i>${utils.escapeHtml(cueNotes)}</div>` : `
                <div style="font-size:0.75rem; color:#aaa; font-style:italic;">No cue notes</div>
              `}
            </div>
            <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.editCueNote('${item.id}')" title="Edit cue note">
              <i class="bi bi-pencil"></i>
            </button>
          </div>
        </div>`;
    });

    container.innerHTML = html;
  },

  async editCueNote(itemId) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item) return;

    const newCue = prompt('Enter cue notes for AV/Lighting team:\n(e.g. "Play intro video", "Dim lights", "Spotlight stage left")', item.cue_notes || '');
    if (newCue === null) return; // cancelled

    item.cue_notes = newCue || null;
    try {
      await STATE.client.from('running_order').update({ cue_notes: newCue || null }).eq('id', itemId);
      utils.showToast('Cue note updated', 'success');
    } catch (error) {
      console.error('Error updating cue note:', error);
    }
    this.renderCueSheetTab();
  },

  /**
   * Print a standalone cue sheet for the AV/lighting team
   */
  printCueSheet() {
    const items = this.runningOrderItems;
    if (items.length === 0) { utils.showToast('No items', 'warning'); return; }

    let presNum = 0;
    let rows = '';
    items.forEach(item => {
      const isBreak = (item.item_type || 'award') !== 'award';
      if (!isBreak) presNum++;
      const time = item.scheduled_time || '';
      const name = item.award_name || 'TBC';
      const cue = item.cue_notes || '-';
      const breakLabel = isBreak ? ` [${(item.item_type || 'break').toUpperCase()}]` : '';

      rows += `<tr${isBreak ? ' style="background:#e3f2fd;"' : ''}>
        <td style="text-align:center; font-weight:bold;">${isBreak ? '-' : presNum}</td>
        <td style="text-align:center;">${utils.escapeHtml(time)}</td>
        <td><strong>${utils.escapeHtml(name)}</strong>${breakLabel}</td>
        <td style="font-family:monospace; color:#1565c0; background:${cue !== '-' ? '#f3f8ff' : 'transparent'};">${utils.escapeHtml(cue)}</td>
      </tr>`;
    });

    const printHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Cue Sheet - ${utils.escapeHtml(this.currentEventName)}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; }
        .header { text-align: center; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 3px solid #1565c0; }
        .header h1 { margin: 0 0 4px 0; font-size: 18pt; color: #1565c0; }
        .header h2 { margin: 0; font-size: 12pt; font-weight: normal; color: #666; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 8px; border: 1px solid #ccc; text-align: left; }
        th { background: #1565c0; color: white; font-size: 9pt; text-transform: uppercase; }
        .footer { margin-top: 20px; text-align: center; font-size: 8pt; color: #666; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      <div class="header"><h1>AV / Lighting Cue Sheet</h1><h2>${utils.escapeHtml(this.currentEventName)}</h2></div>
      <table><thead><tr><th style="width:40px;">#</th><th style="width:60px;">Time</th><th>Item</th><th>Cue / Direction</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="footer">Printed: ${new Date().toLocaleString()}</div>
      <script>window.onload=function(){window.print();};</script></body></html>`;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (win) { win.document.write(printHtml); win.document.close(); }
    else { utils.showToast('Please allow popups to print', 'warning'); }
  },

  // ============================================
  // ACT / SECTION HEADERS WITH COLOURS
  // ============================================

  _roSectionConfig: [],

  /**
   * Load section config from settings
   */
  async loadSectionConfig() {
    try {
      const { data: settings } = await STATE.client
        .from('running_order_settings')
        .select('section_config')
        .eq('event_id', this.currentEventIdRunningOrder)
        .single();
      this._roSectionConfig = settings?.section_config || [];
    } catch (error) {
      this._roSectionConfig = [];
    }
  },

  /**
   * Get section config for a given section number
   */
  getSectionConfig(sectionNum) {
    return this._roSectionConfig.find(s => s.section === sectionNum) || null;
  },

  /**
   * Open section manager to define act/section headers
   */
  openSectionManager() {
    const sections = this._roSectionConfig.length > 0
      ? this._roSectionConfig
      : [{ section: 1, name: 'Act 1', colour: '#4caf50' }];

    const modalHtml = `
      <div class="modal fade" id="sectionManagerModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-dark text-white">
              <h5 class="modal-title"><i class="bi bi-palette me-2"></i>Manage Sections / Acts</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="small text-muted mb-3">Define colour-coded sections to visually group your running order into acts. Assign items to sections using the "Section" field in the item's section number.</p>
              <div id="sectionConfigList">
                ${sections.map((s, i) => `
                  <div class="d-flex gap-2 align-items-center mb-2" data-section-idx="${i}">
                    <input type="number" class="form-control form-control-sm" style="width:60px;" value="${s.section}" min="1" placeholder="#">
                    <input type="text" class="form-control form-control-sm" value="${utils.escapeHtml(s.name)}" placeholder="e.g. Act 1: Community Awards">
                    <input type="color" class="form-control form-control-sm form-control-color" value="${s.colour}" style="width:40px; padding:2px;">
                    <button class="btn btn-sm btn-outline-danger" onclick="this.closest('[data-section-idx]').remove()"><i class="bi bi-trash"></i></button>
                  </div>
                `).join('')}
              </div>
              <button class="btn btn-sm btn-outline-secondary mt-2" onclick="eventsModule.addSectionConfigRow()">
                <i class="bi bi-plus me-1"></i>Add Section
              </button>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-dark" onclick="eventsModule.saveSectionConfig()">
                <i class="bi bi-save me-2"></i>Save Sections
              </button>
            </div>
          </div>
        </div>
      </div>`;

    const existing = document.getElementById('sectionManagerModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('sectionManagerModal')).show();
    document.getElementById('sectionManagerModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
  },

  addSectionConfigRow() {
    const list = document.getElementById('sectionConfigList');
    if (!list) return;
    const idx = list.children.length;
    const colours = ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4'];
    const colour = colours[idx % colours.length];
    list.insertAdjacentHTML('beforeend', `
      <div class="d-flex gap-2 align-items-center mb-2" data-section-idx="${idx}">
        <input type="number" class="form-control form-control-sm" style="width:60px;" value="${idx + 1}" min="1" placeholder="#">
        <input type="text" class="form-control form-control-sm" value="" placeholder="e.g. Act ${idx + 1}: Category Name">
        <input type="color" class="form-control form-control-sm form-control-color" value="${colour}" style="width:40px; padding:2px;">
        <button class="btn btn-sm btn-outline-danger" onclick="this.closest('[data-section-idx]').remove()"><i class="bi bi-trash"></i></button>
      </div>
    `);
  },

  async saveSectionConfig() {
    const rows = document.querySelectorAll('#sectionConfigList [data-section-idx]');
    const config = [];
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      config.push({
        section: parseInt(inputs[0].value) || 1,
        name: inputs[1].value.trim() || `Section ${inputs[0].value}`,
        colour: inputs[2].value || '#6c757d'
      });
    });

    this._roSectionConfig = config;

    try {
      await STATE.client
        .from('running_order_settings')
        .upsert({
          event_id: this.currentEventIdRunningOrder,
          section_config: config
        }, { onConflict: 'event_id' });
      utils.showToast('Section configuration saved', 'success');
      bootstrap.Modal.getInstance(document.getElementById('sectionManagerModal')).hide();
      this.renderRunningOrderItems();
    } catch (error) {
      console.error('Error saving section config:', error);
      utils.showToast('Failed to save section config', 'error');
    }
  },

  // ============================================
  // RUNNING ORDER VERSIONING
  // ============================================

  _roVersions: [],

  renderVersionsTab() {
    const container = document.getElementById('roVersionsContent');
    if (!container) return;

    // Load versions first
    this.loadVersions().then(() => {
      let html = `
        <div class="p-3 mb-3 border rounded bg-light d-flex justify-content-between align-items-center">
          <div>
            <strong>Version History</strong>
            <span class="ms-2 text-muted small">${this._roVersions.length} saved version(s)</span>
          </div>
          <button class="btn btn-sm btn-primary" onclick="eventsModule.saveVersion()" ${this.isPublished ? 'disabled' : ''}>
            <i class="bi bi-save me-1"></i>Save Current as Version
          </button>
        </div>
      `;

      if (this._roVersions.length === 0) {
        html += '<div class="text-center py-4 text-muted"><i class="bi bi-clock-history display-4 d-block mb-2 opacity-25"></i><p>No versions saved yet. Save a snapshot before making major changes.</p></div>';
      } else {
        html += `<div class="list-group">`;
        this._roVersions.forEach(v => {
          const itemCount = Array.isArray(v.snapshot) ? v.snapshot.length : 0;
          const date = new Date(v.created_at).toLocaleString();
          html += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>${utils.escapeHtml(v.version_name)}</strong>
                <small class="text-muted d-block">v${v.version_number} | ${itemCount} items | ${date}</small>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-warning" onclick="eventsModule.restoreVersion('${v.id}')" ${this.isPublished ? 'disabled' : ''} title="Restore this version">
                  <i class="bi bi-arrow-counterclockwise me-1"></i>Restore
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="eventsModule.deleteVersion('${v.id}')" title="Delete version">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>`;
        });
        html += '</div>';
      }

      container.innerHTML = html;
    });
  },

  async loadVersions() {
    try {
      const { data, error } = await STATE.client
        .from('running_order_versions')
        .select('*')
        .eq('event_id', this.currentEventIdRunningOrder)
        .order('version_number', { ascending: false });
      if (error) throw error;
      this._roVersions = data || [];
    } catch (error) {
      console.error('Error loading versions:', error);
      this._roVersions = [];
    }
  },

  async saveVersion() {
    const name = prompt('Enter a name for this version:', `v${this._roVersions.length + 1} - ${new Date().toLocaleDateString()}`);
    if (!name) return;

    const snapshot = this.runningOrderItems.map(item => ({
      award_name: item.award_name,
      display_name: item.display_name,
      award_number: item.award_number,
      display_order: item.display_order,
      section: item.section,
      item_type: item.item_type,
      sponsor: item.sponsor,
      recipient_collecting: item.recipient_collecting,
      scheduled_time: item.scheduled_time,
      duration_minutes: item.duration_minutes,
      status: item.status,
      notes: item.notes,
      special_requirements: item.special_requirements,
      cue_notes: item.cue_notes,
      table_number: item.table_number,
      trophy_status: item.trophy_status,
      presentation_group: item.presentation_group,
      organisation_id: item.organisation_id,
      award_id: item.award_id,
      guest_id: item.guest_id
    }));

    try {
      const { error } = await STATE.client
        .from('running_order_versions')
        .insert([{
          event_id: this.currentEventIdRunningOrder,
          version_name: name,
          version_number: this._roVersions.length + 1,
          snapshot: snapshot
        }]);
      if (error) throw error;
      utils.showToast('Version saved: ' + name, 'success');
      this.renderVersionsTab();
    } catch (error) {
      console.error('Error saving version:', error);
      utils.showToast('Failed to save version: ' + error.message, 'error');
    }
  },

  async restoreVersion(versionId) {
    const version = this._roVersions.find(v => v.id === versionId);
    if (!version) return;

    if (!confirm(`Restore "${version.version_name}"?\n\nThis will replace the current running order with this saved version. Consider saving the current version first.`)) {
      return;
    }

    try {
      utils.showLoading();

      // Delete all current items
      await STATE.client
        .from('running_order')
        .delete()
        .eq('event_id', this.currentEventIdRunningOrder);

      // Re-insert from snapshot
      const items = version.snapshot.map(item => ({
        ...item,
        event_id: this.currentEventIdRunningOrder
      }));

      if (items.length > 0) {
        const { error } = await STATE.client
          .from('running_order')
          .insert(items);
        if (error) throw error;
      }

      utils.showToast(`Restored version: ${version.version_name}`, 'success');
      await this.loadRunningOrder();
      this.renderRunningOrderItems();
      this.switchROTab('main');
    } catch (error) {
      console.error('Error restoring version:', error);
      utils.showToast('Failed to restore: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async deleteVersion(versionId) {
    if (!confirm('Delete this saved version?')) return;
    try {
      await STATE.client.from('running_order_versions').delete().eq('id', versionId);
      utils.showToast('Version deleted', 'success');
      this.renderVersionsTab();
    } catch (error) {
      console.error('Error deleting version:', error);
      utils.showToast('Failed to delete version', 'error');
    }
  },

  // ============================================
  // TABLE PLAN LINK
  // ============================================

  /**
   * Render table numbers inline on running order items (shown as small badge)
   * This data is already loaded via the table_number field and rendered in main view.
   * The edit form allows setting table_number.
   * This method provides a quick-assign interface.
   */
  async quickAssignTable(itemId) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item) return;

    const tableNum = prompt(
      `Assign table number for "${item.display_name || item.award_name || 'this item'}":\n(Enter a number, or leave blank to clear)`,
      item.table_number || ''
    );
    if (tableNum === null) return; // cancelled

    const num = tableNum ? parseInt(tableNum) : null;
    item.table_number = num;

    try {
      await STATE.client.from('running_order').update({ table_number: num }).eq('id', itemId);
      utils.showToast(num ? `Assigned to Table ${num}` : 'Table assignment cleared', 'success');
    } catch (error) {
      console.error('Error assigning table:', error);
    }
    this.renderRunningOrderItems();
  },

  // ============================================
  // GROUP / SPLIT PRESENTATIONS
  // ============================================

  /**
   * Build a map of organisation_id -> array of running order items
   */
  _roGetOrgGroups() {
    const groups = {};
    this.runningOrderItems.forEach(item => {
      const orgId = item.organisation_id || item.display_name || item.id;
      if (!groups[orgId]) groups[orgId] = [];
      groups[orgId].push(item);
    });
    return groups;
  },

  /**
   * Check if an item is part of a group (same org has 2+ awards)
   */
  _roIsGrouped(item) {
    return item.presentation_group && this.runningOrderItems.filter(
      i => i.presentation_group === item.presentation_group
    ).length > 1;
  },

  /**
   * Get all items in the same presentation group
   */
  _roGetGroupMembers(groupId) {
    return this.runningOrderItems.filter(i => i.presentation_group === groupId);
  },

  /**
   * Get the number of awards this org has in the running order
   */
  _roOrgAwardCount(item) {
    const orgKey = item.organisation_id || item.display_name;
    if (!orgKey) return 1;
    return this.runningOrderItems.filter(i =>
      (i.organisation_id && i.organisation_id === item.organisation_id) ||
      (!i.organisation_id && i.display_name === item.display_name)
    ).length;
  },

  /**
   * Group items: merge an org's awards into one presentation
   * All awards for this org get the same presentation_group and are moved adjacent
   */
  async groupPresentation(itemId) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item) return;

    this._roPushUndo();

    const orgKey = item.organisation_id || item.display_name;
    const groupId = item.organisation_id || `group_${Date.now()}`;

    // Find all items for this org
    const orgItems = this.runningOrderItems.filter(i =>
      (i.organisation_id && i.organisation_id === item.organisation_id) ||
      (!i.organisation_id && i.display_name === item.display_name)
    );

    if (orgItems.length < 2) {
      utils.showToast('This organisation only has one award', 'info');
      return;
    }

    // Set the group ID on all of them
    orgItems.forEach(i => { i.presentation_group = groupId; });

    // Move all grouped items to be adjacent (after the first one's position)
    const firstIdx = this.runningOrderItems.indexOf(orgItems[0]);
    const others = orgItems.slice(1);

    // Remove others from their current positions
    others.forEach(oi => {
      const idx = this.runningOrderItems.indexOf(oi);
      if (idx > -1) this.runningOrderItems.splice(idx, 1);
    });

    // Re-find the first item's new index after removals
    const newFirstIdx = this.runningOrderItems.indexOf(orgItems[0]);

    // Insert others right after the first
    others.forEach((oi, i) => {
      this.runningOrderItems.splice(newFirstIdx + 1 + i, 0, oi);
    });

    this._roRecalcNumbers();

    // Persist group IDs
    for (const oi of orgItems) {
      try {
        await STATE.client.from('running_order')
          .update({ presentation_group: groupId, display_order: oi.display_order, award_number: oi.award_number })
          .eq('id', oi.id);
      } catch (e) { console.error('Error grouping:', e); }
    }

    this.renderRunningOrderItems();
    utils.showToast(`Grouped ${orgItems.length} awards for ${item.display_name || 'this organisation'} into one presentation`, 'success');
  },

  /**
   * Split: break a grouped item out into its own separate presentation
   */
  async splitPresentation(itemId) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item || !item.presentation_group) return;

    this._roPushUndo();

    const oldGroup = item.presentation_group;
    item.presentation_group = null;

    // If only one item remains in the old group, clear that one too
    const remaining = this.runningOrderItems.filter(i => i.presentation_group === oldGroup);
    if (remaining.length === 1) {
      remaining[0].presentation_group = null;
      try {
        await STATE.client.from('running_order')
          .update({ presentation_group: null })
          .eq('id', remaining[0].id);
      } catch (e) { console.error('Error clearing last group member:', e); }
    }

    try {
      await STATE.client.from('running_order')
        .update({ presentation_group: null })
        .eq('id', itemId);
    } catch (e) { console.error('Error splitting:', e); }

    this._roRecalcNumbers();
    this.renderRunningOrderItems();
    utils.showToast(`Split "${item.award_name || 'Award'}" into a separate presentation`, 'success');
  },

  /**
   * Split ALL awards for an org back into individual presentations
   */
  async splitAllPresentation(itemId) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item || !item.presentation_group) return;

    this._roPushUndo();

    const groupId = item.presentation_group;
    const members = this.runningOrderItems.filter(i => i.presentation_group === groupId);

    members.forEach(m => { m.presentation_group = null; });

    for (const m of members) {
      try {
        await STATE.client.from('running_order')
          .update({ presentation_group: null })
          .eq('id', m.id);
      } catch (e) { console.error('Error splitting all:', e); }
    }

    this._roRecalcNumbers();
    this.renderRunningOrderItems();
    utils.showToast(`Split ${members.length} awards into separate presentations`, 'success');
  },

  // ============================================
  // SYNC FROM RSVPs
  // ============================================
  async syncFromRSVPs() {
    try {
      utils.showLoading();
      const { data, error } = await STATE.client
        .rpc('populate_running_order_from_rsvps', {
          p_event_id: this.currentEventIdRunningOrder
        });
      if (error) throw error;
      utils.showToast(`Added ${data || 0} new items from RSVPs`, 'success');
      await this.loadRunningOrder();
      this.renderRunningOrderItems();
    } catch (error) {
      console.error('Error syncing from RSVPs:', error);
      utils.showToast('Failed to sync from RSVPs: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Toggle Publish Mode
   */
  async togglePublishMode() {
    try {
      const newPublishedState = !this.isPublished;
      const { error } = await STATE.client
        .from('running_order_settings')
        .upsert({
          event_id: this.currentEventIdRunningOrder,
          is_published: newPublishedState,
          published_at: newPublishedState ? new Date().toISOString() : null
        }, { onConflict: 'event_id' });

      if (error) throw error;
      this.isPublished = newPublishedState;
      utils.showToast(newPublishedState ? 'Running order published and locked' : 'Running order unlocked for editing', 'success');
      document.getElementById('runningOrderModal').remove();
      this.createRunningOrderModal();
    } catch (error) {
      console.error('Error toggling publish mode:', error);
      utils.showToast('Failed to update publish status', 'error');
    }
  },

  /**
   * Save Running Order
   */
  async saveRunningOrder() {
    try {
      utils.showLoading();
      for (const item of this.runningOrderItems) {
        const { error } = await STATE.client
          .from('running_order')
          .update({
            display_order: item.display_order,
            award_number: item.award_number,
            presentation_group: item.presentation_group || null,
            scheduled_time: item.scheduled_time || null
          })
          .eq('id', item.id);
        if (error) throw error;
      }
      utils.showToast('Running order saved', 'success');
    } catch (error) {
      console.error('Error saving running order:', error);
      utils.showToast('Failed to save running order', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Print Running Order - With grouped presentations
   */
  printRunningOrder() {
    if (this.runningOrderItems.length === 0) {
      utils.showToast('No items to print', 'warning');
      return;
    }

    let cumMin = 0;
    let presNum = 0;
    const renderedGroups = new Set();
    let rows = '';

    this.runningOrderItems.forEach(item => {
      const awardName = item.award_name || (item.awards ? item.awards.award_name : 'N/A');
      const companyName = item.display_name || (item.organisations ? item.organisations.company_name : 'N/A');
      const recipient = item.recipient_collecting || (item.event_guests ? item.event_guests.guest_name : '');
      const notes = item.notes || item.special_requirements || '';
      const time = item.scheduled_time || '';
      const duration = item.duration_minutes || 3;
      cumMin += duration;
      const status = item.status || 'pending';
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      const itemType = item.item_type || 'award';
      const isBreak = itemType !== 'award';
      const sponsor = item.sponsor || '';
      const sponsorHtml = sponsor ? `<br><small style="color:#666; font-style:italic;">Sponsored by ${utils.escapeHtml(sponsor)}</small>` : '';

      // Section break rendering
      if (isBreak) {
        presNum++;
        const breakLabels = { 'break': 'BREAK', 'speech': 'SPEECH', 'entertainment': 'ENTERTAINMENT', 'interval': 'INTERVAL', 'other': 'OTHER' };
        rows += `<tr style="background:#e3f2fd; font-style:italic;">
          <td class="award-number" style="color:#5e35b1;">${presNum}</td>
          <td class="time-col">${utils.escapeHtml(time)}</td>
          <td class="award-name" colspan="3"><strong>${utils.escapeHtml(awardName)}</strong> <span style="color:#7e57c2; font-size:8pt;">[${breakLabels[itemType] || 'BREAK'}]</span></td>
          <td class="status-col">${statusLabel}</td>
        </tr>`;
        if (notes) rows += `<tr style="background:#e3f2fd;"><td colspan="6" class="notes"><strong>Notes:</strong> ${utils.escapeHtml(notes)}</td></tr>`;
        return;
      }

      const isGrouped = item.presentation_group && this.runningOrderItems.filter(
        i => i.presentation_group === item.presentation_group
      ).length > 1;

      if (isGrouped) {
        const isGroupStart = !renderedGroups.has(item.presentation_group);
        if (isGroupStart) {
          renderedGroups.add(item.presentation_group);
          presNum++;
          const groupMembers = this.runningOrderItems.filter(i => i.presentation_group === item.presentation_group);
          rows += `<tr style="background:#fffde7;">
            <td class="award-number" rowspan="${groupMembers.length}" style="vertical-align:middle; font-size:14pt;">${presNum}</td>
            <td class="time-col">${utils.escapeHtml(time)}</td>
            <td class="award-name">${utils.escapeHtml(awardName)}${sponsorHtml}</td>
            <td class="winner-name" rowspan="${groupMembers.length}" style="vertical-align:middle;"><strong>${utils.escapeHtml(companyName)}</strong><br><small style="color:#666;">Combined presentation</small></td>
            <td class="recipient" rowspan="${groupMembers.length}" style="vertical-align:middle;">${utils.escapeHtml(recipient)}</td>
            <td class="status-col">${statusLabel}</td>
          </tr>`;
          if (notes) rows += `<tr style="background:#fffde7;"><td colspan="3" class="notes"><strong>Notes:</strong> ${utils.escapeHtml(notes)}</td></tr>`;
        } else {
          rows += `<tr style="background:#fffde7;">
            <td class="time-col">${utils.escapeHtml(time)}</td>
            <td class="award-name">${utils.escapeHtml(awardName)}${sponsorHtml}</td>
            <td class="status-col">${statusLabel}</td>
          </tr>`;
          if (notes) rows += `<tr style="background:#fffde7;"><td colspan="3" class="notes"><strong>Notes:</strong> ${utils.escapeHtml(notes)}</td></tr>`;
        }
      } else {
        presNum++;
        rows += `<tr>
          <td class="award-number">${presNum}</td>
          <td class="time-col">${utils.escapeHtml(time)}</td>
          <td class="award-name">${utils.escapeHtml(awardName)}${sponsorHtml}</td>
          <td class="winner-name">${utils.escapeHtml(companyName)}</td>
          <td class="recipient">${utils.escapeHtml(recipient)}</td>
          <td class="status-col">${statusLabel}</td>
        </tr>`;
        if (notes) rows += `<tr><td colspan="6" class="notes"><strong>Notes:</strong> ${utils.escapeHtml(notes)}</td></tr>`;
      }
    });

    const printContent = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Running Order - ${utils.escapeHtml(this.currentEventName)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; margin: 0; }
        .header { text-align: center; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 3px solid #333; }
        .header h1 { margin: 0 0 4px 0; font-size: 20pt; }
        .header h2 { margin: 0; font-size: 14pt; font-weight: normal; color: #666; }
        .print-date { text-align: right; font-size: 8pt; color: #666; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        thead { background: #f0f0f0; }
        th, td { padding: 6px 8px; border: 1px solid #333; text-align: left; }
        th { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; }
        .award-number { text-align: center; font-weight: bold; font-size: 12pt; width: 55px; }
        .time-col { width: 60px; text-align: center; }
        .award-name { font-weight: bold; }
        .recipient { font-style: italic; }
        .status-col { width: 70px; text-align: center; font-size: 9pt; }
        .notes { font-size: 8pt; color: #666; }
        .footer { margin-top: 20px; padding-top: 8px; border-top: 2px solid #333; text-align: center; font-size: 8pt; color: #666; }
        tr { page-break-inside: avoid; }
        thead { display: table-header-group; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      <div class="header"><h1>Awards Ceremony Running Order</h1><h2>${utils.escapeHtml(this.currentEventName)}</h2></div>
      <div class="print-date">Printed: ${new Date().toLocaleString()}</div>
      <table><thead><tr>
        <th class="award-number">#</th><th class="time-col">Time</th><th class="award-name">Award</th>
        <th class="winner-name">Winner</th><th class="recipient">Collecting</th><th class="status-col">Status</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div class="footer"><p>Total: ${this.runningOrderItems.length} awards in ${presNum} presentations | Est. duration: ${cumMin} minutes</p>
      <p>Awards CMS - Running Order</p></div>
      <script>window.onload=function(){window.print();};</script></body></html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      utils.showToast('Please allow popups to print', 'warning');
    }
  },

  /**
   * Delete Running Order Item
   */
  async deleteRunningOrderItem(itemId) {
    if (!confirm('Remove this item from the running order?')) return;
    try {
      const { error } = await STATE.client.from('running_order').delete().eq('id', itemId);
      if (error) throw error;
      utils.showToast('Item removed', 'success');
      await this.loadRunningOrder();
      this.renderRunningOrderItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      utils.showToast('Failed to delete item', 'error');
    }
  },

  /**
   * Export Running Order - Enhanced with time and status
   */
  exportRunningOrder() {
    if (this.runningOrderItems.length === 0) {
      utils.showToast('No items to export', 'warning');
      return;
    }
    const exportData = this.runningOrderItems.map(item => {
      const isGrouped = item.presentation_group && this.runningOrderItems.filter(
        i => i.presentation_group === item.presentation_group
      ).length > 1;
      return {
        'Order': item.display_order,
        'Award Number': item.award_number,
        'Type': item.item_type || 'award',
        'Award Name': item.award_name || 'TBC',
        'Winner': item.display_name || 'TBC',
        'Recipient Collecting': item.recipient_collecting || item.event_guests?.guest_name || 'TBC',
        'Sponsor': item.sponsor || '',
        'Scheduled Time': item.scheduled_time || '',
        'Actual Time': item.actual_time || '',
        'Duration (min)': item.duration_minutes || 3,
        'Status': item.status || 'pending',
        'Presentation': isGrouped ? 'Grouped' : 'Individual',
        'Group ID': item.presentation_group || '',
        'Table #': item.table_number || '',
        'Trophy Status': item.trophy_status || '',
        'Cue Notes': item.cue_notes || '',
        'Notes': item.notes || ''
      };
    });
    const filename = `${this.currentEventName.replace(/[^a-z0-9]/gi, '_')}_running_order_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  /**
   * Add Manual Entry - Enhanced with time and duration fields
   */
  addManualEntry() {
    const eventId = this.currentEventIdRunningOrder;
    if (!eventId) { utils.showToast('No event selected', 'warning'); return; }

    const nextOrder = this.runningOrderItems.length + 1;
    const section = this.runningOrderItems.length > 0
      ? (this.runningOrderItems[this.runningOrderItems.length - 1].section || 1)
      : 1;
    const nextAwardNum = `${section}-${String(nextOrder).padStart(2, '0')}`;

    const modalHtml = `
      <div class="modal fade" id="addManualEntryModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Add Manual Entry</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="addManualEntryForm">
                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Award Number</label>
                    <input type="text" class="form-control" id="manualAwardNumber" value="${nextAwardNum}">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Scheduled Time</label>
                    <input type="time" class="form-control" id="manualScheduledTime">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Duration (min)</label>
                    <input type="number" class="form-control" id="manualDuration" value="3" min="1" max="120">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Award Name <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="manualAwardName" required placeholder="e.g. Best New Business Award">
                </div>
                <div class="mb-3">
                  <label class="form-label">Winner / Display Name <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="manualDisplayName" required placeholder="e.g. Smith & Sons Ltd">
                </div>
                <div class="mb-3">
                  <label class="form-label">Recipient Collecting</label>
                  <input type="text" class="form-control" id="manualRecipient" placeholder="e.g. John Smith">
                </div>
                <div class="mb-3">
                  <label class="form-label">Sponsor / Presented By</label>
                  <input type="text" class="form-control" id="manualSponsor" placeholder="e.g. Sponsored by HSBC">
                </div>
                <div class="mb-3">
                  <label class="form-label">Notes</label>
                  <textarea class="form-control" id="manualNotes" rows="2" placeholder="Special requirements, notes..."></textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="eventsModule.saveManualEntry()">
                <i class="bi bi-plus-circle me-2"></i>Add to Running Order
              </button>
            </div>
          </div>
        </div>
      </div>`;

    const existingModal = document.getElementById('addManualEntryModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('addManualEntryModal'));
    modal.show();
    document.getElementById('addManualEntryModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
  },

  async saveManualEntry() {
    const form = document.getElementById('addManualEntryForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const section = this.runningOrderItems.length > 0
      ? (this.runningOrderItems[this.runningOrderItems.length - 1].section || 1)
      : 1;
    const entryData = {
      event_id: this.currentEventIdRunningOrder,
      award_number: document.getElementById('manualAwardNumber').value.trim() || '1',
      display_order: this.runningOrderItems.length + 1,
      section: section,
      award_name: document.getElementById('manualAwardName').value.trim(),
      display_name: document.getElementById('manualDisplayName').value.trim(),
      recipient_collecting: document.getElementById('manualRecipient').value.trim() || null,
      scheduled_time: document.getElementById('manualScheduledTime').value || null,
      duration_minutes: parseInt(document.getElementById('manualDuration').value) || 3,
      sponsor: document.getElementById('manualSponsor').value.trim() || null,
      notes: document.getElementById('manualNotes').value.trim() || null,
      status: 'pending'
    };

    try {
      const { error } = await STATE.client.from('running_order').insert([entryData]);
      if (error) throw error;
      utils.showToast('Entry added to running order', 'success');
      bootstrap.Modal.getInstance(document.getElementById('addManualEntryModal')).hide();
      await this.loadRunningOrder();
      this.renderRunningOrderItems();
    } catch (error) {
      console.error('Error adding manual entry:', error);
      utils.showToast('Failed to add entry: ' + error.message, 'error');
    }
  },

  /**
   * Edit Running Order Item - Enhanced with time and duration
   */
  async editRunningOrderItem(itemId) {
    const item = this.runningOrderItems.find(i => i.id === itemId);
    if (!item) { utils.showToast('Item not found', 'error'); return; }

    const modalHtml = `
      <div class="modal fade" id="editRunningOrderModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Running Order Item</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="editRunningOrderForm">
                <div class="row">
                  <div class="col-md-3 mb-3">
                    <label class="form-label">Award Number</label>
                    <input type="text" class="form-control" id="editROAwardNumber" value="${utils.escapeHtml(String(item.award_number || ''))}">
                  </div>
                  <div class="col-md-3 mb-3">
                    <label class="form-label">Scheduled Time</label>
                    <input type="time" class="form-control" id="editROScheduledTime" value="${item.scheduled_time || ''}">
                  </div>
                  <div class="col-md-3 mb-3">
                    <label class="form-label">Duration (min)</label>
                    <input type="number" class="form-control" id="editRODuration" value="${item.duration_minutes || 3}" min="1" max="120">
                  </div>
                  <div class="col-md-3 mb-3">
                    <label class="form-label">Item Type</label>
                    <select class="form-select" id="editROItemType">
                      <option value="award" ${(item.item_type || 'award') === 'award' ? 'selected' : ''}>Award</option>
                      <option value="break" ${item.item_type === 'break' ? 'selected' : ''}>Break</option>
                      <option value="speech" ${item.item_type === 'speech' ? 'selected' : ''}>Speech</option>
                      <option value="entertainment" ${item.item_type === 'entertainment' ? 'selected' : ''}>Entertainment</option>
                      <option value="interval" ${item.item_type === 'interval' ? 'selected' : ''}>Interval</option>
                      <option value="other" ${item.item_type === 'other' ? 'selected' : ''}>Other</option>
                    </select>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Award Name</label>
                  <input type="text" class="form-control" id="editROAwardName" value="${utils.escapeHtml(item.award_name || '')}">
                </div>
                <div class="mb-3">
                  <label class="form-label">Winner / Display Name</label>
                  <input type="text" class="form-control" id="editRODisplayName" value="${utils.escapeHtml(item.display_name || '')}">
                </div>
                <div class="mb-3">
                  <label class="form-label">Recipient Collecting</label>
                  <input type="text" class="form-control" id="editRORecipient" value="${utils.escapeHtml(item.recipient_collecting || '')}">
                </div>
                <div class="mb-3">
                  <label class="form-label">Sponsor / Presented By</label>
                  <input type="text" class="form-control" id="editROSponsor" value="${utils.escapeHtml(item.sponsor || '')}">
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Cue Notes (AV/Lighting)</label>
                    <textarea class="form-control" id="editROCueNotes" rows="2" placeholder="e.g. Play video, dim lights, spotlight stage left">${utils.escapeHtml(item.cue_notes || '')}</textarea>
                  </div>
                  <div class="col-md-3 mb-3">
                    <label class="form-label">Table #</label>
                    <input type="number" class="form-control" id="editROTableNumber" value="${item.table_number || ''}" min="1" placeholder="e.g. 7">
                  </div>
                  <div class="col-md-3 mb-3">
                    <label class="form-label">Trophy Status</label>
                    <select class="form-select" id="editROTrophyStatus">
                      <option value="not_started" ${(item.trophy_status || 'not_started') === 'not_started' ? 'selected' : ''}>Not Started</option>
                      <option value="ordered" ${item.trophy_status === 'ordered' ? 'selected' : ''}>Ordered</option>
                      <option value="engraved" ${item.trophy_status === 'engraved' ? 'selected' : ''}>Engraved</option>
                      <option value="checked" ${item.trophy_status === 'checked' ? 'selected' : ''}>Checked</option>
                      <option value="backstage_ready" ${item.trophy_status === 'backstage_ready' ? 'selected' : ''}>Backstage Ready</option>
                    </select>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Notes</label>
                  <textarea class="form-control" id="editRONotes" rows="2">${utils.escapeHtml(item.notes || '')}</textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label">Special Requirements</label>
                  <textarea class="form-control" id="editROSpecialReqs" rows="2">${utils.escapeHtml(item.special_requirements || '')}</textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-success" onclick="eventsModule.updateRunningOrderItem('${itemId}')">
                <i class="bi bi-save me-2"></i>Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>`;

    const existingModal = document.getElementById('editRunningOrderModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('editRunningOrderModal'));
    modal.show();
    document.getElementById('editRunningOrderModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
  },

  async updateRunningOrderItem(itemId) {
    const updateData = {
      award_number: document.getElementById('editROAwardNumber').value || null,
      award_name: document.getElementById('editROAwardName').value || null,
      display_name: document.getElementById('editRODisplayName').value || null,
      recipient_collecting: document.getElementById('editRORecipient').value || null,
      scheduled_time: document.getElementById('editROScheduledTime').value || null,
      duration_minutes: parseInt(document.getElementById('editRODuration').value) || 3,
      item_type: document.getElementById('editROItemType').value || 'award',
      sponsor: document.getElementById('editROSponsor').value || null,
      cue_notes: document.getElementById('editROCueNotes').value || null,
      table_number: parseInt(document.getElementById('editROTableNumber').value) || null,
      trophy_status: document.getElementById('editROTrophyStatus').value || 'not_started',
      notes: document.getElementById('editRONotes').value || null,
      special_requirements: document.getElementById('editROSpecialReqs').value || null
    };

    try {
      const { error } = await STATE.client.from('running_order').update(updateData).eq('id', itemId);
      if (error) throw error;
      utils.showToast('Item updated', 'success');
      bootstrap.Modal.getInstance(document.getElementById('editRunningOrderModal')).hide();
      await this.loadRunningOrder();
      this.renderRunningOrderItems();
    } catch (error) {
      console.error('Error updating item:', error);
      utils.showToast('Failed to update item: ' + error.message, 'error');
    }
  },

  // ========================================
  // TABLE PLAN MANAGEMENT - INTERACTIVE CANVAS
  // ========================================

  currentEventIdTablePlan: null,
  currentEventNameTablePlan: null,
  tables: [],
  unassignedGuests: [],
  draggedGuestId: null,
  draggedGuestData: null,
  draggedGuestIsCompany: false,
  draggedCompanyGuests: [],
  _tableDrag: null, // {tableId, startX, startY, offsetX, offsetY}
  _selectedTableId: null,
  _canvasZoom: 1,
  _guestSearchTerm: '',

  /**
   * Open Table Plan Modal
   */
  async openTablePlanModal(eventId, eventName) {
    this.currentEventIdTablePlan = eventId;
    this.currentEventNameTablePlan = eventName;
    this._selectedTableId = null;
    this._canvasZoom = 1;
    this._guestSearchTerm = '';

    try {
      utils.showLoading();
      await this.loadTablePlan();
      this.createTablePlanModal();
    } catch (error) {
      console.error('Error opening table plan:', error);
      utils.showToast('Failed to load table plan: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Create Table Plan Modal - Interactive Canvas Floor Plan
   */
  createTablePlanModal() {
    const existingModal = document.getElementById('tablePlanModal');
    if (existingModal) existingModal.remove();

    const totalGuests = this.unassignedGuests.length;
    const totalSeated = this.tables.reduce((sum, t) => sum + (t.assignments?.length || 0), 0);

    const modalHtml = `
      <div class="modal fade" id="tablePlanModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-fullscreen">
          <div class="modal-content">
            <!-- Header -->
            <div class="modal-header py-2" style="background: #1a1a2e; color: white;">
              <div class="d-flex align-items-center gap-3">
                <h5 class="modal-title mb-0">
                  <i class="bi bi-grid-3x3-gap me-2"></i>Table Plan - ${utils.escapeHtml(this.currentEventNameTablePlan)}
                </h5>
                <span class="badge bg-info">${totalSeated} seated</span>
                <span class="badge bg-warning text-dark">${totalGuests} unassigned</span>
              </div>
              <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-light" onclick="eventsModule.autoAssignGuests()" title="Auto Assign">
                  <i class="bi bi-magic me-1"></i>Auto Assign
                </button>
                <div class="dropdown">
                  <button class="btn btn-sm btn-outline-light dropdown-toggle" data-bs-toggle="dropdown">
                    <i class="bi bi-download me-1"></i>Export
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item" href="#" onclick="eventsModule.exportTablePlan(); return false;"><i class="bi bi-filetype-csv me-2"></i>Export CSV</a></li>
                    <li><a class="dropdown-item" href="#" onclick="eventsModule.exportTablePlanPDF(); return false;"><i class="bi bi-file-pdf me-2"></i>Export PDF (Print)</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="#" onclick="eventsModule.openTVDisplay(); return false;"><i class="bi bi-tv me-2"></i>TV / Projector Display</a></li>
                  </ul>
                </div>
                <button class="btn btn-sm btn-outline-light" onclick="eventsModule.showTablePlanStats()" title="Stats Summary">
                  <i class="bi bi-bar-chart"></i>
                </button>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
            </div>

            <div class="modal-body p-0">
              <div class="d-flex" style="height: calc(100vh - 56px);">

                <!-- Left Sidebar: Guests grouped by company -->
                <div class="tp-sidebar border-end bg-light" style="width: 300px; min-width: 300px; display: flex; flex-direction: column;">
                  <div class="p-2 border-bottom">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text"><i class="bi bi-search"></i></span>
                      <input type="text" class="form-control" id="tpGuestSearch" placeholder="Search guests or companies..." oninput="eventsModule.filterGuests(this.value)">
                    </div>
                  </div>
                  <div class="p-2 border-bottom d-flex justify-content-between align-items-center">
                    <small class="fw-bold text-muted">UNASSIGNED GUESTS</small>
                    <span class="badge bg-primary" id="tpUnassignedCount">${totalGuests}</span>
                  </div>
                  <div id="unassignedGuestsList" class="flex-grow-1 overflow-auto p-2">
                    <!-- Guests grouped by company rendered here -->
                  </div>
                </div>

                <!-- Main Canvas Area -->
                <div class="flex-grow-1 d-flex flex-column">
                  <!-- Canvas Toolbar -->
                  <div class="d-flex align-items-center gap-2 p-2 border-bottom bg-white">
                    <button class="btn btn-sm btn-primary" onclick="eventsModule.addNewTable()">
                      <i class="bi bi-plus-circle me-1"></i>Add Table
                    </button>
                    <div class="vr"></div>
                    <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.canvasZoom(0.1)" title="Zoom In">
                      <i class="bi bi-zoom-in"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.canvasZoom(-0.1)" title="Zoom Out">
                      <i class="bi bi-zoom-out"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.canvasZoom(0, true)" title="Reset Zoom">
                      <i class="bi bi-arrows-fullscreen"></i>
                    </button>
                    <small class="text-muted" id="tpZoomLevel">100%</small>
                    <div class="vr"></div>
                    <small class="text-muted"><i class="bi bi-arrows-move me-1"></i>Drag tables to position. Drop guests onto tables to assign.</small>
                  </div>

                  <!-- Canvas (the room) -->
                  <div id="tpCanvasWrapper" class="flex-grow-1 overflow-auto position-relative" style="background: #f0f2f5; background-image: radial-gradient(circle, #d0d0d0 1px, transparent 1px); background-size: 30px 30px;"
                       ondragover="eventsModule.handleCanvasDragOver(event)"
                       ondrop="eventsModule.handleCanvasDrop(event)">
                    <div id="tpCanvas" class="position-relative" style="width: 2400px; height: 1600px; transform-origin: 0 0;">
                      <!-- Tables rendered here as absolutely positioned elements -->
                    </div>
                  </div>
                </div>

                <!-- Right Panel: Table Detail (shown when a table is selected) -->
                <div id="tpDetailPanel" class="border-start bg-white" style="width: 320px; min-width: 320px; display: none; flex-direction: column;">
                  <div id="tpDetailContent">
                    <!-- Filled when a table is clicked -->
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        /* Sidebar guest styles */
        .tp-sidebar .company-group { margin-bottom: 4px; }
        .tp-sidebar .company-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 10px; background: #e9ecef; border-radius: 6px; cursor: pointer;
          font-size: 0.8rem; font-weight: 600; user-select: none; transition: background 0.15s;
        }
        .tp-sidebar .company-header:hover { background: #dee2e6; }
        .tp-sidebar .company-header.draggable-company { cursor: grab; }
        .tp-sidebar .company-header.draggable-company:active { cursor: grabbing; }
        .tp-sidebar .company-guests { padding: 2px 0 2px 8px; }
        .tp-sidebar .guest-chip {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 8px; margin: 2px 0; background: white; border: 1.5px solid #dee2e6;
          border-radius: 6px; font-size: 0.78rem; cursor: grab; transition: all 0.15s;
        }
        .tp-sidebar .guest-chip:hover { border-color: #0d6efd; background: #f0f6ff; }
        .tp-sidebar .guest-chip.dragging { opacity: 0.4; }
        .tp-sidebar .guest-chip .guest-name { font-weight: 500; }
        .tp-sidebar .no-company-label { font-style: italic; color: #6c757d; }

        /* Canvas table elements */
        .tp-table-el {
          position: absolute; cursor: grab; user-select: none;
          transition: box-shadow 0.2s, transform 0.1s;
        }
        .tp-table-el:hover { z-index: 10; }
        .tp-table-el.dragging-table { opacity: 0.7; cursor: grabbing; z-index: 100; }
        .tp-table-el.selected { z-index: 20; }
        .tp-table-el.drag-over-table .tp-table-shape { filter: brightness(1.15); box-shadow: 0 0 0 4px #0d6efd, 0 0 20px rgba(13,110,253,0.4); }

        .tp-table-shape {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          transition: all 0.2s; border: 3px solid #495057; background: white; position: relative;
        }
        .tp-table-shape.round { border-radius: 50%; }
        .tp-table-shape.rectangular { border-radius: 10px; }
        .tp-table-shape.oval { border-radius: 50%; }

        .tp-table-shape .table-label {
          font-weight: 700; font-size: 0.95rem; color: #1a1a2e; line-height: 1.1; text-align: center;
          pointer-events: none;
        }
        .tp-table-shape .table-sublabel {
          font-size: 0.7rem; color: #6c757d; pointer-events: none;
        }
        .tp-table-shape .seat-badge {
          position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
          background: #495057; color: white; font-size: 0.65rem; font-weight: 600;
          padding: 1px 8px; border-radius: 10px; white-space: nowrap; pointer-events: none;
        }

        /* Seat dots around table */
        .seat-dot {
          position: absolute; width: 18px; height: 18px; border-radius: 50%;
          background: #e9ecef; border: 2px solid #adb5bd;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.5rem; font-weight: 700; color: #495057; pointer-events: none;
        }
        .seat-dot.occupied { background: #0d6efd; border-color: #0a58ca; color: white; }

        /* Capacity colours on table border */
        .tp-table-shape.cap-empty { border-color: #6c757d; }
        .tp-table-shape.cap-partial { border-color: #0d6efd; }
        .tp-table-shape.cap-nearly { border-color: #fd7e14; }
        .tp-table-shape.cap-full { border-color: #dc3545; }

        .tp-table-el.selected .tp-table-shape {
          box-shadow: 0 0 0 3px rgba(13,110,253,0.5), 0 4px 15px rgba(0,0,0,0.2);
        }

        /* Detail panel */
        #tpDetailPanel .detail-header {
          padding: 12px 16px; background: #1a1a2e; color: white;
          display: flex; justify-content: space-between; align-items: center;
        }
        #tpDetailPanel .detail-body { padding: 16px; overflow-y: auto; flex: 1; }
        #tpDetailPanel .seated-guest {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 10px; margin-bottom: 4px; background: #f8f9fa; border-radius: 6px;
          font-size: 0.82rem; border: 1px solid #e9ecef;
        }
        #tpDetailPanel .seated-guest:hover { background: #e9ecef; }
        #tpDetailPanel .seated-guest .remove-x { cursor: pointer; color: #dc3545; font-size: 1rem; }
        #tpDetailPanel .seated-guest .remove-x:hover { color: #a71d2a; }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('tablePlanModal'));
    modal.show();

    // Render after modal shows
    this.renderUnassignedGuests();
    this.renderCanvasTables();

    // Clean up
    document.getElementById('tablePlanModal').addEventListener('hidden.bs.modal', () => {
      document.getElementById('tablePlanModal').remove();
    });
  },

  /**
   * Load Table Plan Data
   */
  async loadTablePlan() {
    try {
      const { data: tables, error: tablesError } = await STATE.client
        .from('event_tables')
        .select('*')
        .eq('event_id', this.currentEventIdTablePlan)
        .eq('is_active', true)
        .order('table_number', { ascending: true });

      if (tablesError) throw tablesError;
      this.tables = tables || [];

      // Load assignments for each table
      for (const table of this.tables) {
        const { data: assignments, error: assignError } = await STATE.client
          .from('table_assignments')
          .select('*')
          .eq('table_id', table.id);
        if (assignError) throw assignError;
        table.assignments = assignments || [];
      }

      // Load unassigned guests
      const { data: unassigned, error: unassignedError } = await STATE.client
        .rpc('get_unassigned_guests', { p_event_id: this.currentEventIdTablePlan });
      if (unassignedError) throw unassignedError;
      this.unassignedGuests = unassigned || [];

    } catch (error) {
      console.error('Error loading table plan:', error);
      throw error;
    }
  },

  // ---- SIDEBAR: Guests grouped by company ----

  filterGuests(term) {
    this._guestSearchTerm = (term || '').toLowerCase();
    this.renderUnassignedGuests();
  },

  _groupGuestsByCompany(guests) {
    const groups = {};
    for (const g of guests) {
      const key = g.company_name || '__none__';
      if (!groups[key]) groups[key] = { company_name: g.company_name || null, organisation_id: g.organisation_id || null, guests: [] };
      groups[key].guests.push(g);
    }
    // Sort: companies with names first, then "No Company"
    return Object.values(groups).sort((a, b) => {
      if (!a.company_name && b.company_name) return 1;
      if (a.company_name && !b.company_name) return -1;
      return (a.company_name || '').localeCompare(b.company_name || '');
    });
  },

  renderUnassignedGuests() {
    const container = document.getElementById('unassignedGuestsList');
    if (!container) return;

    // Update count badge
    const countBadge = document.getElementById('tpUnassignedCount');
    if (countBadge) countBadge.textContent = this.unassignedGuests.length;

    if (this.unassignedGuests.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4 text-muted">
          <i class="bi bi-check-circle display-4 d-block mb-2"></i>
          <p class="small">All guests assigned!</p>
        </div>`;
      return;
    }

    // Filter
    let filtered = this.unassignedGuests;
    if (this._guestSearchTerm) {
      filtered = filtered.filter(g =>
        (g.guest_name || '').toLowerCase().includes(this._guestSearchTerm) ||
        (g.company_name || '').toLowerCase().includes(this._guestSearchTerm)
      );
    }

    const groups = this._groupGuestsByCompany(filtered);

    container.innerHTML = groups.map(group => {
      const companyLabel = group.company_name
        ? utils.escapeHtml(group.company_name)
        : '<span class="no-company-label">No Company</span>';

      return `
        <div class="company-group">
          <div class="company-header draggable-company"
               draggable="true"
               data-company-name="${utils.escapeHtml(group.company_name || '')}"
               data-organisation-id="${group.organisation_id || ''}"
               ondragstart="eventsModule.handleCompanyDragStart(event)"
               ondragend="eventsModule.handleGuestDragEnd(event)"
               onclick="this.nextElementSibling.classList.toggle('d-none')">
            <span>${companyLabel}</span>
            <span class="badge bg-secondary">${group.guests.length}</span>
          </div>
          <div class="company-guests">
            ${group.guests.map(guest => `
              <div class="guest-chip"
                   draggable="true"
                   data-guest-id="${guest.guest_id}"
                   data-guest-name="${utils.escapeHtml(guest.guest_name)}"
                   data-company-name="${utils.escapeHtml(guest.company_name || '')}"
                   data-organisation-id="${guest.organisation_id || ''}"
                   ondragstart="eventsModule.handleGuestDragStart(event)"
                   ondragend="eventsModule.handleGuestDragEnd(event)">
                <i class="bi bi-person-fill text-muted" style="font-size:0.75rem;"></i>
                <span class="guest-name">${utils.escapeHtml(guest.guest_name)}</span>
                ${guest.plus_ones > 0 ? `<span class="badge bg-info ms-auto" style="font-size:0.6rem;">+${guest.plus_ones}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>`;
    }).join('');
  },

  // ---- CANVAS: Render tables as positioned shapes ----

  _getTableSize(table) {
    const seats = table.total_seats || 8;
    if (table.shape === 'rectangular') {
      const w = Math.max(120, 50 + seats * 12);
      return { w, h: 80 };
    }
    // round or oval
    const diam = Math.max(100, 50 + seats * 8);
    return table.shape === 'oval' ? { w: diam * 1.3, h: diam * 0.85 } : { w: diam, h: diam };
  },

  _getCapacityClass(assigned, total) {
    if (assigned === 0) return 'cap-empty';
    if (assigned >= total) return 'cap-full';
    if (assigned >= total * 0.75) return 'cap-nearly';
    return 'cap-partial';
  },

  _seatDotPositions(seats, shape, w, h) {
    const dots = [];
    const dotSize = 18;
    if (shape === 'rectangular') {
      // Place seats along the perimeter of rectangle
      const perimeter = 2 * (w + h);
      for (let i = 0; i < seats; i++) {
        const t = (i + 0.5) / seats * perimeter;
        let x, y;
        if (t < w) { x = t; y = -dotSize / 2 - 4; }
        else if (t < w + h) { x = w + dotSize / 2 - 4; y = t - w; }
        else if (t < 2 * w + h) { x = w - (t - w - h); y = h + dotSize / 2 - 4; }
        else { x = -dotSize / 2 - 4; y = h - (t - 2 * w - h); }
        dots.push({ x: x - dotSize / 2, y: y - dotSize / 2 });
      }
    } else {
      // round / oval - place around the circumference
      const rx = w / 2 + 14;
      const ry = h / 2 + 14;
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i < seats; i++) {
        const angle = (2 * Math.PI * i) / seats - Math.PI / 2;
        dots.push({
          x: cx + rx * Math.cos(angle) - dotSize / 2,
          y: cy + ry * Math.sin(angle) - dotSize / 2
        });
      }
    }
    return dots;
  },

  renderCanvasTables() {
    const canvas = document.getElementById('tpCanvas');
    if (!canvas) return;

    canvas.style.transform = `scale(${this._canvasZoom})`;
    const zoomLabel = document.getElementById('tpZoomLevel');
    if (zoomLabel) zoomLabel.textContent = Math.round(this._canvasZoom * 100) + '%';

    if (this.tables.length === 0) {
      canvas.innerHTML = `
        <div class="position-absolute d-flex align-items-center justify-content-center" style="inset:0;">
          <div class="text-center text-muted">
            <i class="bi bi-grid-3x3-gap display-3 d-block mb-3 opacity-25"></i>
            <p>Click <strong>Add Table</strong> to start building your floor plan</p>
          </div>
        </div>`;
      return;
    }

    canvas.innerHTML = this.tables.map(table => {
      const sz = this._getTableSize(table);
      const assignedCount = table.assignments?.length || 0;
      const capClass = this._getCapacityClass(assignedCount, table.total_seats);
      const shapeClass = table.shape || 'round';
      const selected = table.id === this._selectedTableId ? 'selected' : '';

      // Default positions if not set - spread tables across canvas
      const idx = this.tables.indexOf(table);
      const px = table.position_x || 80 + (idx % 6) * 200;
      const py = table.position_y || 80 + Math.floor(idx / 6) * 200;

      // Padding around the table shape for seat dots
      const pad = 30;
      const totalW = sz.w + pad * 2;
      const totalH = sz.h + pad * 2;

      // Seat dots
      const dots = this._seatDotPositions(table.total_seats, shapeClass, sz.w, sz.h);
      const dotsHtml = dots.map((d, i) => {
        const occupied = i < assignedCount;
        return `<div class="seat-dot ${occupied ? 'occupied' : ''}" style="left:${d.x + pad}px; top:${d.y + pad}px;">${occupied ? '' : ''}</div>`;
      }).join('');

      return `
        <div class="tp-table-el ${selected}"
             data-table-id="${table.id}"
             style="left:${px}px; top:${py}px; width:${totalW}px; height:${totalH}px;"
             onmousedown="eventsModule.startTableDrag(event, '${table.id}')"
             onclick="eventsModule.selectTable(event, '${table.id}')"
             ondragover="eventsModule.handleTableDragOver(event)"
             ondrop="eventsModule.handleTableDrop(event, '${table.id}')"
             ondragleave="eventsModule.handleTableDragLeave(event)">
          ${dotsHtml}
          <div class="tp-table-shape ${shapeClass} ${capClass}"
               style="width:${sz.w}px; height:${sz.h}px; margin:${pad}px;">
            <div class="table-label">${table.table_name ? utils.escapeHtml(table.table_name) : 'Table ' + table.table_number}</div>
            <div class="table-sublabel">${assignedCount}/${table.total_seats}</div>
            <div class="seat-badge">${assignedCount}/${table.total_seats} seats</div>
          </div>
        </div>`;
    }).join('');
  },

  canvasZoom(delta, reset) {
    if (reset) {
      this._canvasZoom = 1;
    } else {
      this._canvasZoom = Math.min(2, Math.max(0.3, this._canvasZoom + delta));
    }
    this.renderCanvasTables();
  },

  // ---- TABLE DRAGGING (repositioning on canvas) ----

  startTableDrag(event, tableId) {
    // Don't start table drag if it was a click on something else
    if (event.button !== 0) return;

    const el = event.currentTarget;
    this._tableDrag = {
      tableId,
      el,
      startX: event.clientX,
      startY: event.clientY,
      origLeft: parseInt(el.style.left) || 0,
      origTop: parseInt(el.style.top) || 0,
      moved: false
    };

    el.classList.add('dragging-table');

    const onMove = (e) => {
      if (!this._tableDrag) return;
      const dx = (e.clientX - this._tableDrag.startX) / this._canvasZoom;
      const dy = (e.clientY - this._tableDrag.startY) / this._canvasZoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._tableDrag.moved = true;
      const newX = Math.max(0, this._tableDrag.origLeft + dx);
      const newY = Math.max(0, this._tableDrag.origTop + dy);
      this._tableDrag.el.style.left = newX + 'px';
      this._tableDrag.el.style.top = newY + 'px';
    };

    const onUp = async (e) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!this._tableDrag) return;

      this._tableDrag.el.classList.remove('dragging-table');

      if (this._tableDrag.moved) {
        // Save new position
        const newX = Math.max(0, Math.round(parseInt(this._tableDrag.el.style.left)));
        const newY = Math.max(0, Math.round(parseInt(this._tableDrag.el.style.top)));
        try {
          await STATE.client
            .from('event_tables')
            .update({ position_x: newX, position_y: newY })
            .eq('id', tableId);
          // Update local data
          const t = this.tables.find(t => t.id === tableId);
          if (t) { t.position_x = newX; t.position_y = newY; }
        } catch (err) {
          console.error('Error saving table position:', err);
        }
      }
      this._tableDrag = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    event.preventDefault();
  },

  // ---- TABLE SELECTION & DETAIL PANEL ----

  selectTable(event, tableId) {
    // Don't select if we just dragged
    if (this._tableDrag && this._tableDrag.moved) return;

    this._selectedTableId = tableId;
    this.renderCanvasTables();
    this.showTableDetail(tableId);
  },

  showTableDetail(tableId) {
    const panel = document.getElementById('tpDetailPanel');
    const content = document.getElementById('tpDetailContent');
    if (!panel || !content) return;

    const table = this.tables.find(t => t.id === tableId);
    if (!table) { panel.style.display = 'none'; return; }

    const assignedCount = table.assignments?.length || 0;

    content.innerHTML = `
      <div class="detail-header">
        <h6 class="mb-0">${table.table_name ? utils.escapeHtml(table.table_name) : 'Table ' + table.table_number}</h6>
        <button class="btn btn-sm btn-outline-light" onclick="eventsModule.closeTableDetail()">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="detail-body d-flex flex-column">
        <!-- Edit fields -->
        <div class="mb-3">
          <label class="form-label small fw-bold">Table Name</label>
          <input type="text" class="form-control form-control-sm" id="tpEditName" value="${utils.escapeHtml(table.table_name || '')}" placeholder="e.g. VIP Table, Sponsor Table">
        </div>
        <div class="row mb-3">
          <div class="col-6">
            <label class="form-label small fw-bold">Seats</label>
            <input type="number" class="form-control form-control-sm" id="tpEditSeats" value="${table.total_seats}" min="1" max="20">
          </div>
          <div class="col-6">
            <label class="form-label small fw-bold">Shape</label>
            <select class="form-select form-select-sm" id="tpEditShape">
              <option value="round" ${table.shape === 'round' ? 'selected' : ''}>Round</option>
              <option value="rectangular" ${table.shape === 'rectangular' ? 'selected' : ''}>Rectangular</option>
              <option value="oval" ${table.shape === 'oval' ? 'selected' : ''}>Oval</option>
            </select>
          </div>
        </div>
        <button class="btn btn-sm btn-primary mb-3" onclick="eventsModule.saveTableProperties('${table.id}')">
          <i class="bi bi-check-lg me-1"></i>Save Changes
        </button>
        <hr>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <small class="fw-bold text-muted">SEATED GUESTS (${assignedCount}/${table.total_seats})</small>
        </div>
        <div class="flex-grow-1 overflow-auto">
          ${table.assignments && table.assignments.length > 0 ? table.assignments.map(a => `
            <div class="seated-guest">
              <div>
                <div class="fw-medium">${utils.escapeHtml(a.guest_name)}</div>
                ${a.company_name ? `<small class="text-muted">${utils.escapeHtml(a.company_name)}</small>` : ''}
              </div>
              <span class="remove-x" onclick="eventsModule.removeGuestFromTable('${a.id}')" title="Remove">
                <i class="bi bi-x-circle-fill"></i>
              </span>
            </div>
          `).join('') : '<p class="text-muted small text-center mt-3">Drop guests onto this table to assign them</p>'}
        </div>
        <hr>
        <div class="d-flex gap-2 mb-2">
          <button class="btn btn-sm btn-outline-secondary flex-fill" onclick="eventsModule.duplicateTable('${table.id}')">
            <i class="bi bi-copy me-1"></i>Duplicate
          </button>
          <button class="btn btn-sm btn-outline-warning flex-fill" onclick="eventsModule.clearTable('${table.id}')" ${assignedCount === 0 ? 'disabled' : ''}>
            <i class="bi bi-eraser me-1"></i>Clear
          </button>
        </div>
        <button class="btn btn-sm btn-outline-danger w-100" onclick="eventsModule.deleteTable('${table.id}')">
          <i class="bi bi-trash me-1"></i>Delete Table
        </button>
      </div>
    `;

    panel.style.display = 'flex';
  },

  closeTableDetail() {
    this._selectedTableId = null;
    const panel = document.getElementById('tpDetailPanel');
    if (panel) panel.style.display = 'none';
    this.renderCanvasTables();
  },

  async saveTableProperties(tableId) {
    const name = document.getElementById('tpEditName')?.value?.trim() || null;
    const seats = parseInt(document.getElementById('tpEditSeats')?.value) || 8;
    const shape = document.getElementById('tpEditShape')?.value || 'round';

    try {
      const { error } = await STATE.client
        .from('event_tables')
        .update({ table_name: name, total_seats: seats, shape })
        .eq('id', tableId);

      if (error) throw error;

      // Update local
      const t = this.tables.find(t => t.id === tableId);
      if (t) { t.table_name = name; t.total_seats = seats; t.shape = shape; }

      utils.showToast('Table updated', 'success');
      this.renderCanvasTables();
      this.showTableDetail(tableId);

    } catch (error) {
      console.error('Error updating table:', error);
      utils.showToast('Failed to update table', 'error');
    }
  },

  // ---- GUEST DRAG HANDLERS ----

  handleGuestDragStart(event) {
    const el = event.currentTarget;
    this.draggedGuestIsCompany = false;
    this.draggedCompanyGuests = [];
    this.draggedGuestData = {
      guest_id: el.dataset.guestId,
      guest_name: el.dataset.guestName,
      company_name: el.dataset.companyName,
      organisation_id: el.dataset.organisationId
    };
    el.classList.add('dragging');
    event.dataTransfer.setData('text/plain', 'guest');
    event.dataTransfer.effectAllowed = 'move';
  },

  handleCompanyDragStart(event) {
    const el = event.currentTarget;
    const companyName = el.dataset.companyName;
    this.draggedGuestIsCompany = true;
    this.draggedCompanyGuests = this.unassignedGuests.filter(g =>
      (g.company_name || '') === (companyName || '')
    );
    this.draggedGuestData = null;
    el.classList.add('dragging');
    event.dataTransfer.setData('text/plain', 'company');
    event.dataTransfer.effectAllowed = 'move';
  },

  handleGuestDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
  },

  handleTableDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over-table');
  },

  handleTableDragLeave(event) {
    event.currentTarget.classList.remove('drag-over-table');
  },

  handleCanvasDragOver(event) {
    event.preventDefault();
  },

  handleCanvasDrop(event) {
    // Only handle drops that didn't land on a table (do nothing)
    event.preventDefault();
  },

  async handleTableDrop(event, tableId) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over-table');

    const table = this.tables.find(t => t.id === tableId);
    if (!table) return;

    const assignedCount = table.assignments?.length || 0;

    if (this.draggedGuestIsCompany && this.draggedCompanyGuests.length > 0) {
      // Bulk assign all company guests
      const availableSeats = table.total_seats - assignedCount;
      const toAssign = this.draggedCompanyGuests.slice(0, availableSeats);
      if (toAssign.length === 0) {
        utils.showToast('Table is full!', 'warning');
        return;
      }
      try {
        const rows = toAssign.map(g => ({
          event_id: this.currentEventIdTablePlan,
          table_id: tableId,
          guest_id: g.guest_id || g.id,
          guest_name: g.guest_name,
          organisation_id: g.organisation_id || null,
          company_name: g.company_name || null
        }));
        const { error } = await STATE.client.from('table_assignments').insert(rows);
        if (error) throw error;
        utils.showToast(`${toAssign.length} guest(s) assigned to table`, 'success');
        if (toAssign.length < this.draggedCompanyGuests.length) {
          utils.showToast(`${this.draggedCompanyGuests.length - toAssign.length} guest(s) didn't fit - table full`, 'warning');
        }
        await this.loadTablePlan();
        this.renderUnassignedGuests();
        this.renderCanvasTables();
        if (this._selectedTableId === tableId) this.showTableDetail(tableId);
      } catch (error) {
        console.error('Error assigning company guests:', error);
        utils.showToast('Failed to assign guests', 'error');
      }
    } else if (this.draggedGuestData) {
      // Single guest assign
      if (assignedCount >= table.total_seats) {
        utils.showToast('Table is full!', 'warning');
        return;
      }
      try {
        const { error } = await STATE.client
          .from('table_assignments')
          .insert([{
            event_id: this.currentEventIdTablePlan,
            table_id: tableId,
            guest_id: this.draggedGuestData.guest_id,
            guest_name: this.draggedGuestData.guest_name,
            organisation_id: this.draggedGuestData.organisation_id || null,
            company_name: this.draggedGuestData.company_name || null
          }]);
        if (error) throw error;
        utils.showToast('Guest assigned to table', 'success');
        await this.loadTablePlan();
        this.renderUnassignedGuests();
        this.renderCanvasTables();
        if (this._selectedTableId === tableId) this.showTableDetail(tableId);
      } catch (error) {
        console.error('Error assigning guest:', error);
        utils.showToast('Failed to assign guest', 'error');
      }
    }

    this.draggedGuestData = null;
    this.draggedGuestIsCompany = false;
    this.draggedCompanyGuests = [];
  },

  // ---- ADD / DELETE / REMOVE ----

  async addNewTable() {
    try {
      const { data: nextNumber, error: numberError } = await STATE.client
        .rpc('get_next_table_number', { p_event_id: this.currentEventIdTablePlan });
      if (numberError) throw numberError;

      // Place new table in a visible spot on the canvas
      const canvas = document.getElementById('tpCanvasWrapper');
      const scrollLeft = canvas ? canvas.scrollLeft : 0;
      const scrollTop = canvas ? canvas.scrollTop : 0;
      const cx = Math.round((scrollLeft + 300) / this._canvasZoom);
      const cy = Math.round((scrollTop + 200) / this._canvasZoom);

      const { error } = await STATE.client
        .from('event_tables')
        .insert([{
          event_id: this.currentEventIdTablePlan,
          table_number: nextNumber,
          total_seats: 8,
          shape: 'round',
          position_x: cx + (this.tables.length % 4) * 180,
          position_y: cy + Math.floor(this.tables.length % 12 / 4) * 180
        }]);
      if (error) throw error;

      utils.showToast('Table added', 'success');
      await this.loadTablePlan();
      this.renderCanvasTables();

    } catch (error) {
      console.error('Error adding table:', error);
      utils.showToast('Failed to add table', 'error');
    }
  },

  async deleteTable(tableId) {
    if (!confirm('Delete this table? All seated guests will be unassigned.')) return;

    try {
      const { error } = await STATE.client
        .from('event_tables')
        .delete()
        .eq('id', tableId);
      if (error) throw error;

      if (this._selectedTableId === tableId) this.closeTableDetail();
      utils.showToast('Table deleted', 'success');
      await this.loadTablePlan();
      this.renderUnassignedGuests();
      this.renderCanvasTables();
    } catch (error) {
      console.error('Error deleting table:', error);
      utils.showToast('Failed to delete table', 'error');
    }
  },

  async removeGuestFromTable(assignmentId) {
    try {
      const { error } = await STATE.client
        .from('table_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;

      utils.showToast('Guest removed from table', 'success');
      await this.loadTablePlan();
      this.renderUnassignedGuests();
      this.renderCanvasTables();
      if (this._selectedTableId) this.showTableDetail(this._selectedTableId);
    } catch (error) {
      console.error('Error removing guest:', error);
      utils.showToast('Failed to remove guest', 'error');
    }
  },

  saveTablePlan() {
    utils.showToast('Table plan saved (auto-saves on each action)', 'success');
  },

  // ---- AUTO ASSIGN ----

  async autoAssignGuests() {
    if (this.unassignedGuests.length === 0) {
      utils.showToast('No unassigned guests to assign', 'info');
      return;
    }
    if (this.tables.length === 0) {
      utils.showToast('No tables available. Add tables first.', 'warning');
      return;
    }

    const tablesWithSpace = this.tables
      .map(table => ({
        ...table,
        assignedCount: table.assignments ? table.assignments.length : 0,
        availableSeats: table.total_seats - (table.assignments ? table.assignments.length : 0)
      }))
      .filter(t => t.availableSeats > 0)
      .sort((a, b) => b.availableSeats - a.availableSeats);

    const totalAvailable = tablesWithSpace.reduce((sum, t) => sum + t.availableSeats, 0);
    if (totalAvailable === 0) {
      utils.showToast('All tables are full. Add more tables or increase seats.', 'warning');
      return;
    }

    // Group unassigned guests by company for smarter auto-assign
    const groups = this._groupGuestsByCompany(this.unassignedGuests);
    const guestsToAssign = Math.min(this.unassignedGuests.length, totalAvailable);

    if (!confirm(`Auto-assign ${guestsToAssign} guest(s) across ${tablesWithSpace.length} table(s)?\n\nGuests from the same company will be kept together where possible.`)) {
      return;
    }

    try {
      utils.showLoading();
      let assigned = 0;

      // Try to seat each company group together
      for (const group of groups) {
        if (assigned >= guestsToAssign) break;

        // Find a table that can fit the whole company
        let bestTable = tablesWithSpace.find(t => t.availableSeats >= group.guests.length);
        if (!bestTable) bestTable = tablesWithSpace.find(t => t.availableSeats > 0);
        if (!bestTable) break;

        for (const guest of group.guests) {
          if (assigned >= guestsToAssign) break;
          // Find table with space (prefer current bestTable)
          let targetTable = bestTable.availableSeats > 0 ? bestTable : tablesWithSpace.find(t => t.availableSeats > 0);
          if (!targetTable) break;

          const { error } = await STATE.client
            .from('table_assignments')
            .insert([{
              event_id: this.currentEventIdTablePlan,
              table_id: targetTable.id,
              guest_id: guest.guest_id || guest.id,
              guest_name: guest.guest_name,
              organisation_id: guest.organisation_id || null,
              company_name: guest.company_name || null
            }]);

          if (!error) {
            targetTable.availableSeats--;
            assigned++;
          }
        }
      }

      utils.showToast(`Successfully assigned ${assigned} guest(s) to tables`, 'success');
      await this.loadTablePlan();
      this.renderUnassignedGuests();
      this.renderCanvasTables();
      if (this._selectedTableId) this.showTableDetail(this._selectedTableId);

    } catch (error) {
      console.error('Error auto-assigning guests:', error);
      utils.showToast('Failed to auto-assign guests: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ---- EXPORT ----

  exportTablePlan() {
    if (this.tables.length === 0) {
      utils.showToast('No tables to export', 'warning');
      return;
    }

    const exportData = [];
    this.tables.forEach(table => {
      if (table.assignments && table.assignments.length > 0) {
        table.assignments.forEach(assignment => {
          exportData.push({
            'Table Number': table.table_number,
            'Table Name': table.table_name || '',
            'Total Seats': table.total_seats,
            'Guest Name': assignment.guest_name,
            'Company': assignment.company_name || '',
            'VIP': assignment.is_vip ? 'Yes' : 'No',
            'Dietary': assignment.dietary_requirements || ''
          });
        });
      } else {
        exportData.push({
          'Table Number': table.table_number,
          'Table Name': table.table_name || '',
          'Total Seats': table.total_seats,
          'Guest Name': '(Empty)',
          'Company': '',
          'VIP': '',
          'Dietary': ''
        });
      }
    });

    const filename = `${this.currentEventNameTablePlan.replace(/[^a-z0-9]/gi, '_')}_table_plan_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  // ---- PDF EXPORT (print-friendly) ----

  exportTablePlanPDF() {
    if (this.tables.length === 0) {
      utils.showToast('No tables to export', 'warning');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');
      const eventName = this.currentEventNameTablePlan || 'Event';
      const dateStr = new Date().toLocaleDateString('en-GB');

      // Title page
      doc.setFontSize(28);
      doc.setTextColor(26, 26, 46);
      doc.text('Table Plan', 148.5, 60, { align: 'center' });
      doc.setFontSize(18);
      doc.setTextColor(13, 110, 253);
      doc.text(eventName, 148.5, 75, { align: 'center' });
      doc.setFontSize(11);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated: ${dateStr}`, 148.5, 88, { align: 'center' });

      // Summary stats
      const totalSeats = this.tables.reduce((s, t) => s + t.total_seats, 0);
      const totalSeated = this.tables.reduce((s, t) => s + (t.assignments?.length || 0), 0);
      doc.setFontSize(12);
      doc.setTextColor(80, 80, 80);
      doc.text(`${this.tables.length} Tables  |  ${totalSeated}/${totalSeats} Seats Filled  |  ${this.unassignedGuests.length} Unassigned`, 148.5, 100, { align: 'center' });

      // Table-by-table detail pages
      doc.addPage('landscape');
      doc.setFontSize(16);
      doc.setTextColor(26, 26, 46);
      doc.text('Seating Assignments', 14, 18);

      // Build table data for autoTable
      const tableData = [];
      this.tables.forEach(table => {
        const label = table.table_name ? `Table ${table.table_number} - ${table.table_name}` : `Table ${table.table_number}`;
        const assigned = table.assignments?.length || 0;
        if (table.assignments && table.assignments.length > 0) {
          table.assignments.forEach((a, i) => {
            tableData.push([
              i === 0 ? label : '',
              i === 0 ? `${assigned}/${table.total_seats}` : '',
              a.guest_name,
              a.company_name || '',
              a.dietary_requirements || '',
              a.is_vip ? 'VIP' : ''
            ]);
          });
        } else {
          tableData.push([label, `0/${table.total_seats}`, '(No guests)', '', '', '']);
        }
      });

      doc.autoTable({
        startY: 24,
        head: [['Table', 'Capacity', 'Guest Name', 'Company', 'Dietary', 'VIP']],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [26, 26, 46], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 18, halign: 'center' }
        },
        didParseCell: (data) => {
          // Bold table name rows
          if (data.column.index === 0 && data.cell.raw) {
            data.cell.styles.fontStyle = 'bold';
          }
          // Highlight VIP
          if (data.column.index === 5 && data.cell.raw === 'VIP') {
            data.cell.styles.textColor = [220, 53, 69];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      // Unassigned guests page (if any)
      if (this.unassignedGuests.length > 0) {
        doc.addPage('landscape');
        doc.setFontSize(16);
        doc.setTextColor(26, 26, 46);
        doc.text('Unassigned Guests', 14, 18);

        const unassignedData = this.unassignedGuests.map(g => [
          g.guest_name,
          g.company_name || '',
          g.guest_email || ''
        ]);

        doc.autoTable({
          startY: 24,
          head: [['Guest Name', 'Company', 'Email']],
          body: unassignedData,
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [255, 193, 7], textColor: [0, 0, 0], fontStyle: 'bold' }
        });
      }

      const safeName = eventName.replace(/[^a-z0-9]/gi, '_');
      doc.save(`${safeName}_Table_Plan_${new Date().toISOString().split('T')[0]}.pdf`);
      utils.showToast('PDF exported successfully', 'success');

    } catch (error) {
      console.error('Error exporting PDF:', error);
      utils.showToast('Failed to export PDF: ' + error.message, 'error');
    }
  },

  // ---- TV / PROJECTOR DISPLAY ----

  openTVDisplay() {
    if (this.tables.length === 0) {
      utils.showToast('No tables to display', 'warning');
      return;
    }

    const eventName = utils.escapeHtml(this.currentEventNameTablePlan || 'Event');
    const totalSeats = this.tables.reduce((s, t) => s + t.total_seats, 0);
    const totalSeated = this.tables.reduce((s, t) => s + (t.assignments?.length || 0), 0);

    // Build table cards HTML
    const tablesHtml = this.tables.map(table => {
      const assigned = table.assignments?.length || 0;
      const pct = table.total_seats > 0 ? Math.round(assigned / table.total_seats * 100) : 0;
      const barColor = assigned >= table.total_seats ? '#dc3545' : assigned >= table.total_seats * 0.75 ? '#fd7e14' : '#0d6efd';
      const shapeIcon = table.shape === 'rectangular' ? 'bi-square' : 'bi-circle';
      const label = table.table_name ? `${table.table_name}` : `Table ${table.table_number}`;

      const guestsHtml = (table.assignments || []).map(a => `
        <div style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:500;">${utils.escapeHtml(a.guest_name)}</span>
          <span style="font-size:0.75em; opacity:0.6;">${a.company_name ? utils.escapeHtml(a.company_name) : ''}</span>
        </div>
      `).join('');

      return `
        <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:12px; overflow:hidden; break-inside:avoid;">
          <div style="padding:14px 16px; background:rgba(255,255,255,0.04); border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:1.2em; font-weight:700;"><i class="bi ${shapeIcon} me-2" style="opacity:0.5;"></i>${label}</div>
              ${table.table_name ? `<div style="font-size:0.75em; opacity:0.5;">Table ${table.table_number}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <div style="font-size:1.4em; font-weight:700; color:${barColor};">${assigned}<span style="font-size:0.6em; opacity:0.5;">/${table.total_seats}</span></div>
            </div>
          </div>
          <div style="height:3px; background:rgba(255,255,255,0.1);"><div style="height:100%; width:${pct}%; background:${barColor}; transition:width 0.3s;"></div></div>
          ${guestsHtml || '<div style="padding:12px; text-align:center; opacity:0.3; font-style:italic;">No guests assigned</div>'}
        </div>
      `;
    }).join('');

    // Open a new window with dark-themed display
    const tvWindow = window.open('', '_blank', 'width=1920,height=1080');
    if (!tvWindow) {
      utils.showToast('Please allow popups to open the TV display', 'warning');
      return;
    }

    tvWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Table Plan - ${eventName}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            color: white; min-height: 100vh; padding: 30px 40px;
          }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { font-size: 2.5em; font-weight: 800; letter-spacing: -1px; }
          .header .subtitle { font-size: 1.1em; opacity: 0.6; margin-top: 4px; }
          .header .stats { margin-top: 12px; display: flex; justify-content: center; gap: 30px; }
          .header .stat { background: rgba(255,255,255,0.08); padding: 8px 20px; border-radius: 20px; font-size: 0.9em; }
          .header .stat strong { color: #7c83ff; font-size: 1.2em; }
          .tables-grid {
            columns: 3; column-gap: 20px;
          }
          .tables-grid > div { margin-bottom: 20px; }
          @media (max-width: 1200px) { .tables-grid { columns: 2; } }
          @media (max-width: 768px) { .tables-grid { columns: 1; } }
          .footer { text-align: center; margin-top: 30px; opacity: 0.3; font-size: 0.8em; }
          /* Auto-scroll animation for tall content */
          @keyframes scrollUp {
            0%, 10% { transform: translateY(0); }
            90%, 100% { transform: translateY(var(--scroll-distance)); }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1><i class="bi bi-grid-3x3-gap me-2"></i>${eventName}</h1>
          <div class="subtitle">Table Plan</div>
          <div class="stats">
            <div class="stat"><strong>${this.tables.length}</strong> Tables</div>
            <div class="stat"><strong>${totalSeated}</strong>/${totalSeats} Seated</div>
            ${this.unassignedGuests.length > 0 ? `<div class="stat"><strong>${this.unassignedGuests.length}</strong> Unassigned</div>` : ''}
          </div>
        </div>
        <div class="tables-grid">
          ${tablesHtml}
        </div>
        <div class="footer">Press F11 for fullscreen &bull; Press F5 to refresh</div>
      </body>
      </html>
    `);
    tvWindow.document.close();

    utils.showToast('TV display opened in new window. Press F11 for fullscreen.', 'success');
  },

  // ---- STATS SUMMARY ----

  showTablePlanStats() {
    const totalTables = this.tables.length;
    const totalSeats = this.tables.reduce((s, t) => s + t.total_seats, 0);
    const totalSeated = this.tables.reduce((s, t) => s + (t.assignments?.length || 0), 0);
    const totalUnassigned = this.unassignedGuests.length;
    const emptyTables = this.tables.filter(t => (t.assignments?.length || 0) === 0).length;
    const fullTables = this.tables.filter(t => (t.assignments?.length || 0) >= t.total_seats).length;
    const occupancyPct = totalSeats > 0 ? Math.round(totalSeated / totalSeats * 100) : 0;

    // Company breakdown
    const companyMap = {};
    this.tables.forEach(t => {
      (t.assignments || []).forEach(a => {
        const company = a.company_name || 'No Company';
        if (!companyMap[company]) companyMap[company] = { seated: 0, tables: new Set() };
        companyMap[company].seated++;
        companyMap[company].tables.add(t.table_number);
      });
    });
    const companySorted = Object.entries(companyMap)
      .sort((a, b) => b[1].seated - a[1].seated)
      .slice(0, 10);

    const companyRows = companySorted.map(([name, data]) =>
      `<tr><td>${utils.escapeHtml(name)}</td><td class="text-center">${data.seated}</td><td class="text-center">${[...data.tables].sort((a,b)=>a-b).join(', ')}</td></tr>`
    ).join('');

    // Show as a modal overlay
    const existingStats = document.getElementById('tpStatsOverlay');
    if (existingStats) existingStats.remove();

    document.body.insertAdjacentHTML('beforeend', `
      <div id="tpStatsOverlay" style="position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center;" onclick="if(event.target===this)this.remove();">
        <div style="background:white; border-radius:16px; padding:30px; width:560px; max-height:80vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0"><i class="bi bi-bar-chart me-2"></i>Table Plan Stats</h5>
            <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('tpStatsOverlay').remove()"><i class="bi bi-x-lg"></i></button>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-4">
              <div class="p-3 rounded text-center" style="background:#e7f3ff;">
                <div class="fw-bold" style="font-size:2em; color:#0d6efd;">${totalTables}</div>
                <small class="text-muted">Tables</small>
              </div>
            </div>
            <div class="col-4">
              <div class="p-3 rounded text-center" style="background:#e8f5e9;">
                <div class="fw-bold" style="font-size:2em; color:#198754;">${totalSeated}</div>
                <small class="text-muted">Seated</small>
              </div>
            </div>
            <div class="col-4">
              <div class="p-3 rounded text-center" style="background:#fff3e0;">
                <div class="fw-bold" style="font-size:2em; color:#fd7e14;">${totalUnassigned}</div>
                <small class="text-muted">Unassigned</small>
              </div>
            </div>
          </div>

          <div class="mb-3">
            <div class="d-flex justify-content-between mb-1">
              <small class="fw-bold">Occupancy</small>
              <small>${totalSeated}/${totalSeats} seats (${occupancyPct}%)</small>
            </div>
            <div class="progress" style="height:12px;">
              <div class="progress-bar ${occupancyPct >= 90 ? 'bg-danger' : occupancyPct >= 70 ? 'bg-warning' : 'bg-primary'}" style="width:${occupancyPct}%"></div>
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-6"><div class="p-2 border rounded text-center"><strong>${emptyTables}</strong> <small class="text-muted">Empty Tables</small></div></div>
            <div class="col-6"><div class="p-2 border rounded text-center"><strong>${fullTables}</strong> <small class="text-muted">Full Tables</small></div></div>
          </div>

          ${companySorted.length > 0 ? `
            <h6 class="mb-2"><i class="bi bi-building me-1"></i>Top Companies</h6>
            <table class="table table-sm table-bordered mb-0">
              <thead><tr><th>Company</th><th class="text-center">Guests</th><th class="text-center">Tables</th></tr></thead>
              <tbody>${companyRows}</tbody>
            </table>
          ` : ''}
        </div>
      </div>
    `);
  },

  // ---- DUPLICATE TABLE ----

  async duplicateTable(tableId) {
    const source = this.tables.find(t => t.id === tableId);
    if (!source) return;

    try {
      const { data: nextNumber, error: numberError } = await STATE.client
        .rpc('get_next_table_number', { p_event_id: this.currentEventIdTablePlan });
      if (numberError) throw numberError;

      const { error } = await STATE.client
        .from('event_tables')
        .insert([{
          event_id: this.currentEventIdTablePlan,
          table_number: nextNumber,
          table_name: source.table_name ? source.table_name + ' (copy)' : null,
          total_seats: source.total_seats,
          shape: source.shape,
          position_x: (source.position_x || 100) + 50,
          position_y: (source.position_y || 100) + 50
        }]);
      if (error) throw error;

      utils.showToast('Table duplicated (empty copy created)', 'success');
      await this.loadTablePlan();
      this.renderCanvasTables();
    } catch (error) {
      console.error('Error duplicating table:', error);
      utils.showToast('Failed to duplicate table', 'error');
    }
  },

  // ---- CLEAR TABLE (remove all guests) ----

  async clearTable(tableId) {
    const table = this.tables.find(t => t.id === tableId);
    if (!table || !table.assignments || table.assignments.length === 0) return;

    if (!confirm(`Remove all ${table.assignments.length} guest(s) from this table?`)) return;

    try {
      const { error } = await STATE.client
        .from('table_assignments')
        .delete()
        .eq('table_id', tableId);
      if (error) throw error;

      utils.showToast('All guests removed from table', 'success');
      await this.loadTablePlan();
      this.renderUnassignedGuests();
      this.renderCanvasTables();
      if (this._selectedTableId === tableId) this.showTableDetail(tableId);
    } catch (error) {
      console.error('Error clearing table:', error);
      utils.showToast('Failed to clear table', 'error');
    }
  },

  // ============================================
  // ENHANCED: STATS, FILTERS, SORT, CALENDAR
  // ============================================
  _sortField: 'event_date',
  _sortDir: 'desc',
  _calendarMonth: new Date().getMonth(),
  _calendarYear: new Date().getFullYear(),

  updateEventStats() {
    const events = STATE.allEvents || [];
    const today = new Date().toISOString().split('T')[0];
    const thisYear = new Date().getFullYear();

    const total = events.length;
    const upcoming = events.filter(e => e.event_date && e.event_date >= today).length;
    const thisYearCount = events.filter(e => e.year === thisYear || (e.event_date && e.event_date.startsWith(String(thisYear)))).length;
    const past = events.filter(e => e.event_date && e.event_date < today).length;

    // Data quality: missing date or venue
    const missingDate = events.filter(e => !e.event_date).length;
    const missingVenue = events.filter(e => !e.venue).length;
    const dataIssues = missingDate + missingVenue;

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('eventsTotalCount', total);
    el('eventsUpcomingCount', upcoming);
    el('eventsThisYearCount', thisYearCount);
    el('eventsPastCount', past);
    el('eventsDataIssuesCount', dataIssues);

    // Data quality bar
    const dqBar = document.getElementById('eventsDataQualityBar');
    const dqText = document.getElementById('eventsDataQualityText');
    if (dqBar && dqText) {
      if (dataIssues > 0) {
        const parts = [];
        if (missingDate > 0) parts.push(`${missingDate} missing date${missingDate > 1 ? 's' : ''}`);
        if (missingVenue > 0) parts.push(`${missingVenue} missing venue${missingVenue > 1 ? 's' : ''}`);
        dqText.textContent = parts.join(', ');
        dqBar.style.display = 'block';
      } else {
        dqBar.style.display = 'none';
      }
    }
  },

  filterEvents() {
    const search = (document.getElementById('eventsSearchBox')?.value || '').toLowerCase().trim();
    const year = document.getElementById('eventsYearFilter')?.value || '';
    const timeStatus = document.getElementById('eventsStatusFilter')?.value || '';
    const eventStatus = document.getElementById('eventsEventStatusFilter')?.value || '';
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    let filtered = (STATE.allEvents || []).filter(e => {
      if (search) {
        const haystack = `${e.event_name || ''} ${e.venue || ''} ${e.description || ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (year && String(e.year) !== year && !(e.event_date && e.event_date.startsWith(year))) return false;
      if (timeStatus === 'upcoming' && (!e.event_date || e.event_date < today)) return false;
      if (timeStatus === 'past' && (!e.event_date || e.event_date >= today)) return false;
      if (timeStatus === 'this-month' && (!e.event_date || e.event_date < monthStart || e.event_date > monthEnd)) return false;
      if (eventStatus && (e.event_status || 'draft') !== eventStatus) return false;
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[this._sortField] || '';
      let bVal = b[this._sortField] || '';
      if (this._sortField === 'year') { aVal = Number(aVal) || 0; bVal = Number(bVal) || 0; }
      if (aVal < bVal) return this._sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return this._sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    this.renderFilteredEvents(filtered);
  },

  filterDataIssues() {
    // Reset all filters first
    const searchBox = document.getElementById('eventsSearchBox');
    const yearFilter = document.getElementById('eventsYearFilter');
    const statusFilter = document.getElementById('eventsStatusFilter');
    const eventStatusFilter = document.getElementById('eventsEventStatusFilter');
    if (searchBox) searchBox.value = '';
    if (yearFilter) yearFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    if (eventStatusFilter) eventStatusFilter.value = '';

    // Filter to only events missing date or venue
    const issues = (STATE.allEvents || []).filter(e => !e.event_date || !e.venue);
    this.renderFilteredEvents(issues);
  },

  sortEvents(field) {
    if (this._sortField === field) {
      this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sortField = field;
      this._sortDir = 'asc';
    }
    this.filterEvents();
  },

  resetEventFilters() {
    const el = id => { const e = document.getElementById(id); if (e) e.value = ''; };
    el('eventsSearchBox');
    el('eventsYearFilter');
    el('eventsStatusFilter');
    el('eventsEventStatusFilter');
    this._sortField = 'event_date';
    this._sortDir = 'desc';
    this.renderEvents();
  },

  _selectedEvents: new Set(),

  renderFilteredEvents(events) {
    const tbody = document.getElementById('eventsTableBody');
    const count = document.getElementById('eventsCount');
    if (!tbody) return;
    if (count) count.textContent = events.length;

    // Update last refreshed
    const refreshEl = document.getElementById('eventsLastRefreshed');
    if (refreshEl) refreshEl.textContent = `Last refreshed: ${new Date().toLocaleTimeString('en-GB')}`;

    // Update filter summary
    const summaryEl = document.getElementById('eventsFilterSummary');
    if (summaryEl) {
      const total = (STATE.allEvents || []).length;
      summaryEl.textContent = events.length < total ? `Showing ${events.length} of ${total}` : `Showing all ${total}`;
    }

    if (events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted"><i class="bi bi-calendar-x fs-1 d-block mb-2 opacity-25"></i>No events match your filters</td></tr>';
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const statusColors = { draft: 'secondary', confirmed: 'success', cancelled: 'danger', complete: 'info' };
    const statusIcons = { draft: 'bi-pencil', confirmed: 'bi-check-circle', cancelled: 'bi-x-circle', complete: 'bi-flag' };

    tbody.innerHTML = events.map(event => {
      const eventDate = event.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '<span class="text-danger small">No date</span>';
      const evtStatus = event.event_status || 'draft';
      const color = statusColors[evtStatus] || 'secondary';
      const icon = statusIcons[evtStatus] || 'bi-circle';
      const statusBadge = `<span class="badge bg-${color}"><i class="bi ${icon} me-1"></i>${evtStatus.charAt(0).toUpperCase() + evtStatus.slice(1)}</span>`;
      const attendees = this.getAttendees(event.id);
      const attendeeCount = attendees ? attendees.length : 0;
      const attending = attendees ? attendees.filter(a => a.status === 'attending').length : 0;
      const capacity = event.capacity || 0;
      const capacityPct = capacity > 0 ? Math.round(attending / capacity * 100) : 0;
      const capBarColor = capacityPct >= 95 ? 'bg-danger' : capacityPct >= 80 ? 'bg-warning' : capacityPct >= 50 ? 'bg-info' : 'bg-success';
      const checked = this._selectedEvents.has(event.id) ? 'checked' : '';
      const eName = utils.escapeHtml(event.event_name).replace(/'/g, "\\'");

      // Build capacity cell
      let capacityCell;
      if (capacity > 0 && attendeeCount > 0) {
        capacityCell = `
          <div class="text-center" style="min-width:90px;">
            <div class="fw-semibold" style="font-size:0.82rem;">${attending}<span class="text-muted">/${capacity}</span></div>
            <div class="progress mt-1" style="height:5px;">
              <div class="progress-bar ${capBarColor}" style="width:${Math.min(capacityPct, 100)}%"></div>
            </div>
            <small class="text-muted" style="font-size:0.65rem;">${capacityPct}% full</small>
            ${capacityPct >= 95 ? '<br><span class="badge bg-danger" style="font-size:0.55rem;">NEAR CAPACITY</span>' : ''}
          </div>`;
      } else if (attendeeCount > 0) {
        capacityCell = `<span class="badge bg-info">${attending}/${attendeeCount}</span>`;
      } else {
        capacityCell = '<span class="text-muted small">-</span>';
      }

      return `
        <tr class="fade-in">
          <td><input type="checkbox" class="form-check-input event-checkbox" value="${event.id}" ${checked} onchange="eventsModule.toggleEventSelect('${event.id}', this.checked)"></td>
          <td class="fw-semibold">${utils.escapeHtml(event.event_name)}${!event.venue ? ' <i class="bi bi-exclamation-triangle text-warning small" title="Missing venue"></i>' : ''}</td>
          <td><span class="badge bg-primary">${utils.escapeHtml(String(event.year || '-'))}</span></td>
          <td>${eventDate}</td>
          <td>${utils.escapeHtml(event.venue || '-')}</td>
          <td class="text-center">${capacityCell}</td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-warning btn-icon" onclick="eventsModule.openRunningOrderModal('${event.id}', '${eName}')" title="Running Order"><i class="bi bi-list-ol"></i></button>
              <button class="btn btn-outline-secondary btn-icon" onclick="eventsModule.openTablePlanModal('${event.id}', '${eName}')" title="Table Plan"><i class="bi bi-table"></i></button>
              <button class="btn btn-outline-info btn-icon" onclick="eventsModule.openAttendeesModal('${event.id}')" title="Attendees"><i class="bi bi-people"></i></button>
              <button class="btn btn-outline-primary btn-icon" onclick="eventsModule.openEditModal('${event.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-outline-success btn-icon" onclick="eventsModule.openCloneModal('${event.id}')" title="Clone"><i class="bi bi-files"></i></button>
              <button class="btn btn-outline-danger btn-icon" onclick="eventsModule.deleteEvent('${event.id}', '${eName}')" title="Delete"><i class="bi bi-trash"></i></button>
            </div>
          </td>
        </tr>`;
    }).join('');
  },

  // ============================================
  // BULK OPERATIONS
  // ============================================
  toggleEventSelect(eventId, checked) {
    if (checked) this._selectedEvents.add(eventId);
    else this._selectedEvents.delete(eventId);
    this._updateBulkBar();
  },

  toggleSelectAll(checked) {
    document.querySelectorAll('.event-checkbox').forEach(cb => {
      cb.checked = checked;
      if (checked) this._selectedEvents.add(cb.value);
      else this._selectedEvents.delete(cb.value);
    });
    this._updateBulkBar();
  },

  clearEventSelection() {
    this._selectedEvents.clear();
    document.querySelectorAll('.event-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('selectAllEvents');
    if (selectAll) selectAll.checked = false;
    this._updateBulkBar();
  },

  _updateBulkBar() {
    const bar = document.getElementById('eventsBulkActionsBar');
    const countEl = document.getElementById('eventsSelectedCount');
    if (!bar) return;
    if (this._selectedEvents.size > 0) {
      bar.style.display = 'flex';
      bar.style.setProperty('display', 'flex', 'important');
      if (countEl) countEl.textContent = this._selectedEvents.size;
    } else {
      bar.style.setProperty('display', 'none', 'important');
    }
  },

  async bulkDelete() {
    const ids = Array.from(this._selectedEvents);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} event(s)? This cannot be undone.`)) return;
    try {
      for (const id of ids) {
        await STATE.client.from('events').delete().eq('id', id);
      }
      utils.showToast(`${ids.length} event(s) deleted`, 'success');
      this.clearEventSelection();
      await this.loadEvents();
    } catch (e) {
      utils.showToast('Error deleting events: ' + e.message, 'error');
    }
  },

  async bulkClone() {
    const ids = Array.from(this._selectedEvents);
    if (ids.length === 0) return;
    if (!confirm(`Clone ${ids.length} event(s)?`)) return;
    try {
      for (const id of ids) {
        const src = STATE.allEvents.find(e => e.id === id);
        if (!src) continue;
        await STATE.client.from('events').insert([{
          event_name: src.event_name + ' (Copy)',
          event_date: src.event_date,
          year: src.year,
          venue: src.venue,
          description: src.description,
          event_status: 'draft'
        }]);
      }
      utils.showToast(`${ids.length} event(s) cloned`, 'success');
      this.clearEventSelection();
      await this.loadEvents();
    } catch (e) {
      utils.showToast('Error cloning events: ' + e.message, 'error');
    }
  },

  async bulkSetStatus(status) {
    const ids = Array.from(this._selectedEvents);
    if (ids.length === 0) return;
    try {
      for (const id of ids) {
        await STATE.client.from('events').update({ event_status: status }).eq('id', id);
      }
      utils.showToast(`${ids.length} event(s) set to ${status}`, 'success');
      this.clearEventSelection();
      await this.loadEvents();
    } catch (e) {
      utils.showToast('Error updating status: ' + e.message, 'error');
    }
  },

  // ============================================
  // CSV IMPORT FOR ATTENDEES
  // ============================================
  showImportAttendeesModal() {
    const events = STATE.allEvents || [];
    if (events.length === 0) { utils.showToast('Create an event first', 'warning'); return; }
    const existingModal = document.getElementById('importAttendeesModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `<div class="modal fade" id="importAttendeesModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title"><i class="bi bi-upload me-2"></i>Import Attendees CSV</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <div class="mb-3"><label class="form-label fw-semibold">Select Event</label>
            <select class="form-select" id="importAttendeesEventId">
              ${events.map(e => `<option value="${e.id}">${utils.escapeHtml(e.event_name)}</option>`).join('')}
            </select></div>
          <div class="mb-3"><label class="form-label fw-semibold">CSV File</label>
            <input type="file" class="form-control" id="importAttendeesFile" accept=".csv">
            <div class="form-text">CSV with columns: Name, Email, RSVP Status (attending/not_attending/maybe)</div></div>
          <div class="mb-3"><label class="form-label fw-semibold">Or paste CSV text:</label>
            <textarea class="form-control" id="importAttendeesText" rows="5" placeholder="Name,Email,Status&#10;John Doe,john@example.com,attending"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary" onclick="eventsModule.executeImportAttendees()"><i class="bi bi-upload me-2"></i>Import</button></div>
      </div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('importAttendeesModal')).show();
  },

  async executeImportAttendees() {
    const eventId = document.getElementById('importAttendeesEventId')?.value;
    if (!eventId) { utils.showToast('Select an event', 'warning'); return; }

    let csvText = document.getElementById('importAttendeesText')?.value?.trim();
    if (!csvText) {
      const file = document.getElementById('importAttendeesFile')?.files[0];
      if (!file) { utils.showToast('Provide CSV file or text', 'warning'); return; }
      csvText = await file.text();
    }

    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) { utils.showToast('CSV needs a header row and at least one data row', 'warning'); return; }

    const existing = this.getAttendees(eventId) || [];
    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const name = cols[0]; const email = cols[1] || '';
      const status = ['attending', 'not_attending', 'maybe'].includes(cols[2]) ? cols[2] : 'attending';
      if (!name) continue;
      existing.push({ id: 'attendee_' + Date.now() + '_' + i, name, email, status, addedAt: new Date().toISOString() });
      imported++;
    }
    this.saveAttendees(eventId, existing);
    bootstrap.Modal.getInstance(document.getElementById('importAttendeesModal'))?.hide();
    utils.showToast(`Imported ${imported} attendee(s)`, 'success');
    this.filterEvents();
  },

  // ============================================
  // PRINT RUNNING ORDER
  // ============================================
  printRunningOrderStandalone(eventId, eventName) {
    const items = this.runningOrderItems || [];
    if (items.length === 0) { utils.showToast('No running order items to print', 'warning'); return; }
    const printWin = window.open('', '_blank');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Running Order - ${utils.escapeHtml(eventName)}</title>
      <style>body{font-family:Arial,sans-serif;margin:40px;color:#333}h1{text-align:center;margin-bottom:5px}
      h2{text-align:center;color:#666;font-weight:normal;margin-bottom:30px}
      table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px 12px;text-align:left}
      th{background:#f5f5f5;font-weight:bold}.num{width:60px;text-align:center}
      .time{width:80px}.footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
      @media print{body{margin:20px}}</style></head><body>
      <h1>${utils.escapeHtml(eventName)}</h1><h2>Running Order</h2>
      <table><thead><tr><th class="num">#</th><th>Award</th><th>Recipient</th><th class="time">Time</th><th>Notes</th></tr></thead><tbody>
      ${items.map((item, i) => `<tr><td class="num">${item.award_number || (i + 1)}</td><td>${utils.escapeHtml(item.award_name || item.display_name || '')}</td>
        <td>${utils.escapeHtml(item.recipient_collecting || '')}</td><td class="time">${item.scheduled_time || '-'}</td>
        <td>${utils.escapeHtml(item.notes || '')}</td></tr>`).join('')}
      </tbody></table><div class="footer">Printed ${new Date().toLocaleString('en-GB')}</div></body></html>`);
    printWin.document.close();
    printWin.print();
  },

  exportEventsCSV() {
    const events = STATE.allEvents || [];
    if (events.length === 0) { utils.showToast('No events to export', 'warning'); return; }
    const rows = [['Event Name', 'Year', 'Date', 'Venue', 'Status', 'Description', 'Attendees']];
    events.forEach(e => {
      const attendees = this.getAttendees(e.id);
      rows.push([e.event_name || '', e.year || '', e.event_date || '', e.venue || '', e.event_status || 'draft', e.description || '', attendees ? attendees.length : 0]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `events_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    utils.showToast('Events exported', 'success');
  },

  // ============================================
  // CALENDAR VIEW
  // ============================================
  showEventsCalendar() {
    document.getElementById('eventsCalendarView').style.display = 'block';
    this.renderCalendar();
  },

  hideEventsCalendar() {
    document.getElementById('eventsCalendarView').style.display = 'none';
  },

  calendarPrev() {
    this._calendarMonth--;
    if (this._calendarMonth < 0) { this._calendarMonth = 11; this._calendarYear--; }
    this.renderCalendar();
  },

  calendarNext() {
    this._calendarMonth++;
    if (this._calendarMonth > 11) { this._calendarMonth = 0; this._calendarYear++; }
    this.renderCalendar();
  },

  renderCalendar() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const titleEl = document.getElementById('eventsCalendarTitle');
    const gridEl = document.getElementById('eventsCalendarGrid');
    if (!titleEl || !gridEl) return;

    titleEl.textContent = `${monthNames[this._calendarMonth]} ${this._calendarYear}`;

    const firstDay = new Date(this._calendarYear, this._calendarMonth, 1).getDay();
    const daysInMonth = new Date(this._calendarYear, this._calendarMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const monthStr = `${this._calendarYear}-${String(this._calendarMonth + 1).padStart(2, '0')}`;
    const monthEvents = (STATE.allEvents || []).filter(e => e.event_date && e.event_date.startsWith(monthStr));
    const eventsByDay = {};
    monthEvents.forEach(e => {
      const day = parseInt(e.event_date.split('-')[2]);
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = dayNames.map(d => `<div class="col text-center small fw-semibold text-muted py-1">${d}</div>`).join('');

    const startDay = firstDay === 0 ? 0 : firstDay;
    for (let i = 0; i < startDay; i++) {
      html += '<div class="col text-center p-1"><div class="rounded p-2" style="min-height:70px;"></div></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${this._calendarYear}-${String(this._calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const dayEvents = eventsByDay[day] || [];
      const bgClass = isToday ? 'bg-primary bg-opacity-10 border border-primary' : dayEvents.length > 0 ? 'bg-success bg-opacity-10 border border-success' : 'bg-light';

      html += `<div class="col text-center p-1">
        <div class="rounded p-2 ${bgClass}" style="min-height:70px;">
          <div class="small ${isToday ? 'fw-bold text-primary' : ''}">${day}</div>
          ${dayEvents.map(e => `<div class="badge bg-primary d-block mt-1 text-truncate" style="font-size:0.65rem; max-width:100%; cursor:pointer;"
            title="${utils.escapeHtml(e.event_name)}" onclick="eventsModule.openEditModal('${e.id}')">${utils.escapeHtml(e.event_name)}</div>`).join('')}
        </div>
      </div>`;

      if ((startDay + day) % 7 === 0 && day < daysInMonth) {
        html += '<div class="w-100"></div>';
      }
    }

    gridEl.innerHTML = html;
  }
};

// Export to window for global access
window.eventsModule = eventsModule;
