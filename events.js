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
      utils.showTableLoading('eventsTableBody', 6);

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
      utils.showEmptyState('eventsTableBody', 6, 'Failed to load events', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Render events table
   */
  renderEvents() {
    const tbody = document.getElementById('eventsTableBody');
    const count = document.getElementById('eventsCount');

    count.textContent = STATE.allEvents.length;

    if (STATE.allEvents.length === 0) {
      utils.showEmptyState('eventsTableBody', 6, 'No events found. Click "Add Event" to create one.');
      return;
    }

    tbody.innerHTML = STATE.allEvents.map(event => {
      const eventDate = event.event_date ? new Date(event.event_date).toLocaleDateString() : '-';

      return `
        <tr class="fade-in">
          <td class="fw-semibold">${utils.escapeHtml(event.event_name)}</td>
          <td><span class="badge bg-primary">${event.year || '-'}</span></td>
          <td>${eventDate}</td>
          <td>${utils.escapeHtml(event.venue || '-')}</td>
          <td>
            <small class="text-muted">${utils.escapeHtml(event.description || 'No description')}</small>
          </td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-warning btn-icon"
                onclick="eventsModule.openRunningOrderModal('${event.id}', '${utils.escapeHtml(event.event_name).replace(/'/g, "\\'")}')"
                title="Running Order">
                <i class="bi bi-list-ol"></i>
              </button>
              <button class="btn btn-outline-secondary btn-icon"
                onclick="eventsModule.openTablePlanModal('${event.id}', '${utils.escapeHtml(event.event_name).replace(/'/g, "\\'")}')"
                title="Table Plan">
                <i class="bi bi-table"></i>
              </button>
              <button class="btn btn-outline-info btn-icon"
                onclick="eventsModule.openAttendeesModal('${event.id}')"
                title="Manage Attendees">
                <i class="bi bi-people"></i>
              </button>
              <button class="btn btn-outline-primary btn-icon"
                onclick="eventsModule.openEditModal('${event.id}')"
                title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-success btn-icon"
                onclick="eventsModule.openCloneModal('${event.id}')"
                title="Clone Event">
                <i class="bi bi-files"></i>
              </button>
              <button class="btn btn-outline-danger btn-icon"
                onclick="eventsModule.deleteEvent('${event.id}', '${utils.escapeHtml(event.event_name).replace(/'/g, "\\'")}')"
                title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
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
    document.getElementById('eventDescription').value = '';
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
    document.getElementById('eventDescription').value = event.description || '';
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
    const eventDescription = document.getElementById('eventDescription').value.trim();

    if (!eventName) {
      utils.showToast('Please enter an event name', 'warning');
      return;
    }

    try {
      utils.showLoading();

      const eventData = {
        event_name: eventName,
        event_date: eventDate || null,
        year: eventYear ? parseInt(eventYear) : null,
        venue: eventVenue || null,
        description: eventDescription || null
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
        description: newEventDescription || null
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
    const container = document.getElementById('templatesList');
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
                  <strong>Gallery Sections:</strong> ${template.gallerySections.join(', ')}
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

    // Set event info
    document.getElementById('attendeesEventId').value = eventId;
    document.getElementById('attendeesEventName').textContent = event.event_name || 'Unnamed Event';
    document.getElementById('attendeesEventDate').textContent = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'No date set';
    document.getElementById('attendeesEventVenue').textContent = event.venue || 'No venue set';

    // Hide add form
    document.getElementById('addAttendeeForm').style.display = 'none';

    // Load and render attendees
    this.renderAttendees(eventId);

    const modal = new bootstrap.Modal(document.getElementById('attendeesModal'));
    modal.show();
  },

  /**
   * Render attendees table
   */
  renderAttendees(eventId) {
    const attendees = this.getAttendees(eventId);
    const tbody = document.getElementById('attendeesTableBody');

    // Update stats
    const attending = attendees.filter(a => a.status === 'attending').length;
    const notAttending = attendees.filter(a => a.status === 'not_attending').length;
    const maybe = attendees.filter(a => a.status === 'maybe').length;

    document.getElementById('attendingCount').textContent = attending;
    document.getElementById('notAttendingCount').textContent = notAttending;
    document.getElementById('maybeCount').textContent = maybe;
    document.getElementById('totalAttendeesCount').textContent = attendees.length;

    if (attendees.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            <i class="bi bi-people display-4 d-block mb-2 opacity-25"></i>
            No attendees yet. Click "Add Attendee" to start tracking RSVPs.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = attendees.map(attendee => {
      const statusBadges = {
        'attending': '<span class="badge bg-success">Attending</span>',
        'not_attending': '<span class="badge bg-danger">Not Attending</span>',
        'maybe': '<span class="badge bg-warning text-dark">Maybe</span>'
      };

      return `
        <tr>
          <td class="fw-semibold">${utils.escapeHtml(attendee.name)}</td>
          <td>${attendee.email ? utils.escapeHtml(attendee.email) : '-'}</td>
          <td>${statusBadges[attendee.status] || attendee.status}</td>
          <td><small class="text-muted">${utils.formatRelativeTime(attendee.addedAt)}</small></td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary btn-sm"
                onclick="eventsModule.updateAttendeeStatus('${attendee.id}', '${attendee.status === 'attending' ? 'not_attending' : 'attending'}')"
                title="Toggle Status">
                <i class="bi bi-arrow-repeat"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm"
                onclick="eventsModule.deleteAttendee('${attendee.id}')"
                title="Remove">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Open add attendee form
   */
  openAddAttendeeForm() {
    const form = document.getElementById('addAttendeeForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';

    // Clear form
    document.getElementById('attendeeName').value = '';
    document.getElementById('attendeeEmail').value = '';
    document.getElementById('attendeeStatus').value = 'attending';
  },

  /**
   * Add new attendee
   */
  addAttendee() {
    const eventId = document.getElementById('attendeesEventId').value;
    const name = document.getElementById('attendeeName').value.trim();
    const email = document.getElementById('attendeeEmail').value.trim();
    const status = document.getElementById('attendeeStatus').value;

    if (!name) {
      utils.showToast('Please enter attendee name', 'warning');
      return;
    }

    const attendees = this.getAttendees(eventId);

    const newAttendee = {
      id: `attendee_${Date.now()}`,
      name: name,
      email: email,
      status: status,
      addedAt: new Date().toISOString()
    };

    attendees.push(newAttendee);
    this.saveAttendees(eventId, attendees);

    // Clear form and hide
    document.getElementById('attendeeName').value = '';
    document.getElementById('attendeeEmail').value = '';
    document.getElementById('addAttendeeForm').style.display = 'none';

    // Re-render
    this.renderAttendees(eventId);

    utils.showToast('Attendee added successfully', 'success');
  },

  /**
   * Update attendee status
   */
  updateAttendeeStatus(attendeeId, newStatus) {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = this.getAttendees(eventId);

    const attendee = attendees.find(a => a.id === attendeeId);
    if (attendee) {
      attendee.status = newStatus;
      this.saveAttendees(eventId, attendees);
      this.renderAttendees(eventId);
      utils.showToast('Status updated', 'success');
    }
  },

  /**
   * Delete attendee
   */
  deleteAttendee(attendeeId) {
    if (!confirm('Remove this attendee from the list?')) return;

    const eventId = document.getElementById('attendeesEventId').value;
    let attendees = this.getAttendees(eventId);

    attendees = attendees.filter(a => a.id !== attendeeId);
    this.saveAttendees(eventId, attendees);
    this.renderAttendees(eventId);

    utils.showToast('Attendee removed', 'success');
  },

  /**
   * Export attendees list to CSV
   */
  exportAttendees() {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = this.getAttendees(eventId);

    if (attendees.length === 0) {
      utils.showToast('No attendees to export', 'warning');
      return;
    }

    const event = STATE.allEvents.find(e => e.id === eventId);
    const eventName = event ? event.event_name : 'Event';

    const exportData = attendees.map(attendee => ({
      'Name': attendee.name,
      'Email': attendee.email || '',
      'RSVP Status': attendee.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      'Added On': utils.formatDate(attendee.addedAt)
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

  /**
   * Open Running Order Modal
   */
  async openRunningOrderModal(eventId, eventName) {
    this.currentEventIdRunningOrder = eventId;
    this.currentEventName = eventName;

    try {
      utils.showLoading();

      // Load running order data
      await this.loadRunningOrder();

      // Create and show modal
      this.createRunningOrderModal();

    } catch (error) {
      console.error('Error opening running order:', error);
      utils.showToast('Failed to load running order: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Create Running Order Modal
   */
  createRunningOrderModal() {
    const existingModal = document.getElementById('runningOrderModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
      <div class="modal fade" id="runningOrderModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header bg-warning">
              <div>
                <h5 class="modal-title">
                  <i class="bi bi-list-ol me-2"></i>Running Order - ${utils.escapeHtml(this.currentEventName)}
                </h5>
                <small class="text-muted d-block">Awards Ceremony Running Order</small>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">

              <!-- Status Bar -->
              <div class="alert ${this.isPublished ? 'alert-success' : 'alert-info'} d-flex justify-content-between align-items-center">
                <div>
                  <i class="bi ${this.isPublished ? 'bi-lock-fill' : 'bi-unlock-fill'} me-2"></i>
                  <strong>${this.isPublished ? 'PUBLISHED MODE' : 'EDIT MODE'}</strong>
                  <span class="ms-2">
                    ${this.isPublished ? 'Running order is locked. Unpublish to make changes.' : 'Drag and drop to reorder. Numbers will auto-update.'}
                  </span>
                </div>
                <button class="btn btn-sm ${this.isPublished ? 'btn-outline-primary' : 'btn-success'}"
                        onclick="eventsModule.togglePublishMode()">
                  <i class="bi ${this.isPublished ? 'bi-unlock' : 'bi-lock'} me-1"></i>
                  ${this.isPublished ? 'Unpublish' : 'Publish'}
                </button>
              </div>

              <!-- Actions Bar -->
              <div class="mb-3 d-flex gap-2">
                <button class="btn btn-primary" onclick="eventsModule.syncFromRSVPs()">
                  <i class="bi bi-arrow-repeat me-2"></i>Sync from RSVPs
                </button>
                <button class="btn btn-outline-secondary" onclick="eventsModule.addManualEntry()">
                  <i class="bi bi-plus-circle me-2"></i>Add Manual Entry
                </button>
                <button class="btn btn-outline-info" onclick="eventsModule.exportRunningOrder()">
                  <i class="bi bi-download me-2"></i>Export
                </button>
                <div class="ms-auto">
                  <span class="badge bg-secondary fs-6">
                    Total: ${this.runningOrderItems.length} awards
                  </span>
                </div>
              </div>

              <!-- Running Order List -->
              <div id="runningOrderList" class="running-order-list">
                <!-- Items will be rendered here -->
              </div>

              ${this.runningOrderItems.length === 0 ? `
                <div class="text-center py-5">
                  <i class="bi bi-inbox display-4 d-block mb-3 opacity-25"></i>
                  <p class="text-muted">No items in running order yet.</p>
                  <button class="btn btn-primary" onclick="eventsModule.syncFromRSVPs()">
                    <i class="bi bi-arrow-repeat me-2"></i>Sync from RSVPs
                  </button>
                </div>
              ` : ''}

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary" onclick="eventsModule.saveRunningOrder()">
                <i class="bi bi-save me-2"></i>Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>
        .running-order-list {
          max-height: 600px;
          overflow-y: auto;
        }
        .running-order-item {
          background: white;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          padding: 15px 20px;
          margin-bottom: 10px;
          cursor: move;
          transition: all 0.2s;
        }
        .running-order-item:hover {
          border-color: #ffc107;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .running-order-item.dragging {
          opacity: 0.5;
        }
        .running-order-item.drag-over {
          border-top: 3px solid #ffc107;
          margin-top: 20px;
        }
        .running-order-item.published {
          cursor: not-allowed;
          background: #f8f9fa;
        }

        /* Column Layouts */
        .award-number-col {
          min-width: 70px;
          text-align: center;
        }
        .award-number {
          font-size: 1.5rem;
          font-weight: bold;
          color: #ffc107;
        }

        .award-winner-col {
          min-width: 300px;
          padding: 0 15px;
        }
        .award-winner-text {
          font-size: 1rem;
          line-height: 1.4;
        }
        .award-name-part {
          font-weight: 600;
          color: #333;
        }
        .separator {
          margin: 0 8px;
          color: #666;
        }
        .winner-name-part {
          color: #0d6efd;
          font-weight: 500;
        }

        .recipient-col {
          min-width: 180px;
          padding: 0 15px;
          border-left: 2px solid #e9ecef;
        }
        .recipient-text {
          text-align: left;
        }

        .actions-col {
          min-width: 100px;
          text-align: right;
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('runningOrderModal'));
    modal.show();

    // Render items after modal is shown
    this.renderRunningOrderItems();

    // Clean up on close
    document.getElementById('runningOrderModal').addEventListener('hidden.bs.modal', () => {
      document.getElementById('runningOrderModal').remove();
    });
  },

  /**
   * Load Running Order from Database
   */
  async loadRunningOrder() {
    try {
      // Load running order items
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

      // Load settings
      const { data: settings, error: settingsError } = await STATE.client
        .from('running_order_settings')
        .select('*')
        .eq('event_id', this.currentEventIdRunningOrder)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error loading settings:', settingsError);
      }

      this.isPublished = settings?.is_published || false;

    } catch (error) {
      console.error('Error loading running order:', error);
      throw error;
    }
  },

  /**
   * Render Running Order Items
   */
  renderRunningOrderItems() {
    const container = document.getElementById('runningOrderList');
    if (!container) return;

    if (this.runningOrderItems.length === 0) {
      return;
    }

    container.innerHTML = this.runningOrderItems.map((item, index) => {
      const recipientName = item.recipient_collecting || item.event_guests?.guest_name || item.display_name || 'TBC';

      return `
      <div class="running-order-item ${this.isPublished ? 'published' : ''}"
           draggable="${!this.isPublished}"
           data-id="${item.id}"
           ondragstart="eventsModule.handleDragStart(event)"
           ondragover="eventsModule.handleDragOver(event)"
           ondrop="eventsModule.handleDrop(event)"
           ondragend="eventsModule.handleDragEnd(event)">
        <div class="d-flex align-items-center gap-3">
          <!-- Award Number -->
          <div class="award-number-col">
            <div class="award-number">${item.award_number}</div>
          </div>

          <!-- Award Name: Winner Name -->
          <div class="award-winner-col flex-grow-1">
            <div class="award-winner-text">
              <span class="award-name-part">${utils.escapeHtml(item.award_name || 'Award TBC')}</span>
              <span class="separator">:</span>
              <span class="winner-name-part">${utils.escapeHtml(item.display_name)}</span>
            </div>
          </div>

          <!-- Recipient Collecting -->
          <div class="recipient-col">
            <div class="recipient-text">
              <small class="text-muted d-block" style="font-size: 0.75rem;">Collecting:</small>
              <strong>${utils.escapeHtml(recipientName)}</strong>
            </div>
          </div>

          <!-- Actions -->
          <div class="actions-col">
            ${!this.isPublished ? `
              <button class="btn btn-sm btn-outline-primary me-1"
                      onclick="eventsModule.editRunningOrderItem('${item.id}')"
                      title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger"
                      onclick="eventsModule.deleteRunningOrderItem('${item.id}')"
                      title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            ` : `
              <span class="badge bg-success">
                <i class="bi bi-check-circle me-1"></i>Published
              </span>
            `}
          </div>
        </div>
      </div>
    `;
    }).join('');
  },

  /**
   * Drag and Drop Handlers
   */
  handleDragStart(event) {
    if (this.isPublished) return;
    this.draggedItemId = event.currentTarget.dataset.id;
    event.currentTarget.classList.add('dragging');
  },

  handleDragOver(event) {
    if (this.isPublished) return;
    event.preventDefault();
    const draggable = document.querySelector('.dragging');
    const afterElement = this.getDragAfterElement(event.currentTarget.parentElement, event.clientY);

    if (afterElement == null) {
      event.currentTarget.parentElement.appendChild(draggable);
    } else {
      event.currentTarget.parentElement.insertBefore(draggable, afterElement);
    }
  },

  handleDrop(event) {
    if (this.isPublished) return;
    event.preventDefault();
  },

  handleDragEnd(event) {
    if (this.isPublished) return;
    event.currentTarget.classList.remove('dragging');
    this.updateOrderFromDOM();
  },

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.running-order-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  },

  /**
   * Update order from DOM after drag
   */
  updateOrderFromDOM() {
    const items = document.querySelectorAll('.running-order-item');
    const newOrder = [];

    items.forEach((item, index) => {
      const id = item.dataset.id;
      const orderItem = this.runningOrderItems.find(i => i.id === id);
      if (orderItem) {
        orderItem.display_order = index + 1;
        // Update award number
        orderItem.award_number = `${orderItem.section || 1}-${String(index + 1).padStart(2, '0')}`;
        newOrder.push(orderItem);
      }
    });

    this.runningOrderItems = newOrder;
    this.renderRunningOrderItems();
  },

  /**
   * Sync from RSVPs
   */
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

      // Update or insert settings
      const { error } = await STATE.client
        .from('running_order_settings')
        .upsert({
          event_id: this.currentEventIdRunningOrder,
          is_published: newPublishedState,
          published_at: newPublishedState ? new Date().toISOString() : null
        }, {
          onConflict: 'event_id'
        });

      if (error) throw error;

      this.isPublished = newPublishedState;
      utils.showToast(
        newPublishedState ? 'Running order published' : 'Running order unpublished',
        'success'
      );

      // Recreate modal to update UI
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

      // Update all items with new order
      for (const item of this.runningOrderItems) {
        const { error } = await STATE.client
          .from('running_order')
          .update({
            display_order: item.display_order,
            award_number: item.award_number
          })
          .eq('id', item.id);

        if (error) throw error;
      }

      utils.showToast('Running order saved successfully', 'success');

    } catch (error) {
      console.error('Error saving running order:', error);
      utils.showToast('Failed to save running order', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete Running Order Item
   */
  async deleteRunningOrderItem(itemId) {
    if (!confirm('Are you sure you want to remove this item from the running order?')) {
      return;
    }

    try {
      const { error } = await STATE.client
        .from('running_order')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      utils.showToast('Item removed from running order', 'success');
      await this.loadRunningOrder();
      this.renderRunningOrderItems();

    } catch (error) {
      console.error('Error deleting item:', error);
      utils.showToast('Failed to delete item', 'error');
    }
  },

  /**
   * Export Running Order
   */
  exportRunningOrder() {
    if (this.runningOrderItems.length === 0) {
      utils.showToast('No items to export', 'warning');
      return;
    }

    const exportData = this.runningOrderItems.map(item => {
      const recipientName = item.recipient_collecting || item.event_guests?.guest_name || item.display_name || 'TBC';
      const awardWinner = `${item.award_name || 'Award TBC'}: ${item.display_name}`;

      return {
        'Award Number': item.award_number,
        'Award: Winner': awardWinner,
        'Recipient Collecting': recipientName
      };
    });

    const filename = `${this.currentEventName.replace(/[^a-z0-9]/gi, '_')}_running_order_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  /**
   * Add Manual Entry (placeholder for future implementation)
   */
  addManualEntry() {
    utils.showToast('Manual entry feature - Coming soon', 'info');
  },

  /**
   * Edit Running Order Item (placeholder for future implementation)
   */
  editRunningOrderItem(itemId) {
    utils.showToast('Edit feature - Coming soon', 'info');
  },

  // ========================================
  // TABLE PLAN MANAGEMENT
  // ========================================

  currentEventIdTablePlan: null,
  currentEventNameTablePlan: null,
  tables: [],
  unassignedGuests: [],
  draggedGuestId: null,
  draggedGuestData: null,

  /**
   * Open Table Plan Modal
   */
  async openTablePlanModal(eventId, eventName) {
    this.currentEventIdTablePlan = eventId;
    this.currentEventNameTablePlan = eventName;

    try {
      utils.showLoading();

      // Load table plan data
      await this.loadTablePlan();

      // Create and show modal
      this.createTablePlanModal();

    } catch (error) {
      console.error('Error opening table plan:', error);
      utils.showToast('Failed to load table plan: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Create Table Plan Modal
   */
  createTablePlanModal() {
    const existingModal = document.getElementById('tablePlanModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
      <div class="modal fade" id="tablePlanModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-fullscreen">
          <div class="modal-content">
            <div class="modal-header bg-secondary text-white">
              <div>
                <h5 class="modal-title">
                  <i class="bi bi-table me-2"></i>Table Plan - ${utils.escapeHtml(this.currentEventNameTablePlan)}
                </h5>
                <small class="d-block">Drag and drop guests to assign tables</small>
              </div>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0">
              <div class="row g-0" style="height: calc(100vh - 120px);">

                <!-- Left Sidebar: Unassigned Guests -->
                <div class="col-md-3 border-end bg-light">
                  <div class="p-3">
                    <h6 class="mb-3">
                      <i class="bi bi-people me-2"></i>Unassigned Guests
                      <span class="badge bg-primary ms-2">${this.unassignedGuests.length}</span>
                    </h6>

                    <div id="unassignedGuestsList" class="guest-list">
                      <!-- Guests will be rendered here -->
                    </div>
                  </div>
                </div>

                <!-- Main Area: Table Layout -->
                <div class="col-md-9">
                  <div class="p-3">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                      <h6 class="mb-0">
                        <i class="bi bi-grid-3x3 me-2"></i>Table Layout
                        <span class="badge bg-secondary ms-2">${this.tables.length} tables</span>
                      </h6>
                      <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="eventsModule.addNewTable()">
                          <i class="bi bi-plus-circle me-1"></i>Add Table
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.autoAssignGuests()">
                          <i class="bi bi-magic me-1"></i>Auto Assign
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="eventsModule.exportTablePlan()">
                          <i class="bi bi-download me-1"></i>Export
                        </button>
                      </div>
                    </div>

                    <div id="tablesGrid" class="tables-grid">
                      <!-- Tables will be rendered here -->
                    </div>
                  </div>
                </div>

              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary" onclick="eventsModule.saveTablePlan()">
                <i class="bi bi-save me-2"></i>Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>
        .guest-list {
          max-height: calc(100vh - 250px);
          overflow-y: auto;
        }
        .guest-item {
          background: white;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          cursor: grab;
          transition: all 0.2s;
        }
        .guest-item:hover {
          border-color: #0d6efd;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .guest-item.dragging {
          opacity: 0.5;
          cursor: grabbing;
        }
        .guest-item strong {
          display: block;
          margin-bottom: 4px;
        }
        .guest-item small {
          color: #6c757d;
        }

        .tables-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          max-height: calc(100vh - 250px);
          overflow-y: auto;
          padding: 10px;
        }
        .table-card {
          background: white;
          border: 3px solid #0d6efd;
          border-radius: 12px;
          padding: 15px;
          min-height: 200px;
          position: relative;
          transition: all 0.2s;
        }
        .table-card:hover {
          box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
        }
        .table-card.drag-over {
          background: #e7f3ff;
          border-color: #0056b3;
        }
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e9ecef;
        }
        .table-number {
          font-size: 1.5rem;
          font-weight: bold;
          color: #0d6efd;
        }
        .table-seats {
          font-size: 0.875rem;
          color: #6c757d;
        }
        .table-guests {
          min-height: 100px;
        }
        .assigned-guest {
          background: #e7f3ff;
          border: 1px solid #0d6efd;
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 6px;
          font-size: 0.875rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .assigned-guest .remove-btn {
          cursor: pointer;
          color: #dc3545;
        }
        .assigned-guest .remove-btn:hover {
          color: #bd2130;
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('tablePlanModal'));
    modal.show();

    // Render content after modal is shown
    this.renderUnassignedGuests();
    this.renderTables();

    // Clean up on close
    document.getElementById('tablePlanModal').addEventListener('hidden.bs.modal', () => {
      document.getElementById('tablePlanModal').remove();
    });
  },

  /**
   * Load Table Plan Data
   */
  async loadTablePlan() {
    try {
      // Load tables
      const { data: tables, error: tablesError } = await STATE.client
        .from('event_tables')
        .select('*')
        .eq('event_id', this.currentEventIdTablePlan)
        .eq('is_active', true)
        .order('table_number', { ascending: true });

      if (tablesError) throw tablesError;

      this.tables = tables || [];

      // Load table assignments for each table
      for (const table of this.tables) {
        const { data: assignments, error: assignError } = await STATE.client
          .from('table_assignments')
          .select('*')
          .eq('table_id', table.id);

        if (assignError) throw assignError;

        table.assignments = assignments || [];
      }

      // Load unassigned guests using the function
      const { data: unassigned, error: unassignedError } = await STATE.client
        .rpc('get_unassigned_guests', {
          p_event_id: this.currentEventIdTablePlan
        });

      if (unassignedError) throw unassignedError;

      this.unassignedGuests = unassigned || [];

    } catch (error) {
      console.error('Error loading table plan:', error);
      throw error;
    }
  },

  /**
   * Render Unassigned Guests
   */
  renderUnassignedGuests() {
    const container = document.getElementById('unassignedGuestsList');
    if (!container) return;

    if (this.unassignedGuests.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4 text-muted">
          <i class="bi bi-check-circle display-4 d-block mb-2"></i>
          <p class="small">All guests assigned!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.unassignedGuests.map(guest => `
      <div class="guest-item"
           draggable="true"
           data-guest-id="${guest.guest_id}"
           data-guest-name="${utils.escapeHtml(guest.guest_name)}"
           data-company-name="${utils.escapeHtml(guest.company_name || '')}"
           data-organisation-id="${guest.organisation_id || ''}"
           ondragstart="eventsModule.handleGuestDragStart(event)"
           ondragend="eventsModule.handleGuestDragEnd(event)">
        <strong>${utils.escapeHtml(guest.guest_name)}</strong>
        ${guest.company_name ? `<small><i class="bi bi-building me-1"></i>${utils.escapeHtml(guest.company_name)}</small>` : ''}
        ${guest.plus_ones > 0 ? `<small class="d-block"><i class="bi bi-plus-circle me-1"></i>+${guest.plus_ones} guests</small>` : ''}
      </div>
    `).join('');
  },

  /**
   * Render Tables
   */
  renderTables() {
    const container = document.getElementById('tablesGrid');
    if (!container) return;

    if (this.tables.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-table display-4 d-block mb-3 opacity-25"></i>
          <p class="text-muted">No tables yet. Click "Add Table" to create one.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.tables.map(table => {
      const assignedCount = table.assignments?.length || 0;
      const availableSeats = table.total_seats - assignedCount;

      return `
        <div class="table-card"
             data-table-id="${table.id}"
             ondragover="eventsModule.handleTableDragOver(event)"
             ondrop="eventsModule.handleTableDrop(event, '${table.id}')"
             ondragleave="eventsModule.handleTableDragLeave(event)">
          <div class="table-header">
            <div>
              <div class="table-number">Table ${table.table_number}</div>
              ${table.table_name ? `<small class="text-muted">${utils.escapeHtml(table.table_name)}</small>` : ''}
            </div>
            <div class="text-end">
              <div class="table-seats">
                <i class="bi bi-people-fill me-1"></i>${assignedCount}/${table.total_seats}
              </div>
              <button class="btn btn-sm btn-outline-danger mt-1"
                      onclick="eventsModule.deleteTable('${table.id}')"
                      title="Delete Table">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
          <div class="table-guests">
            ${table.assignments && table.assignments.length > 0 ? table.assignments.map(assignment => `
              <div class="assigned-guest">
                <div>
                  <strong>${utils.escapeHtml(assignment.guest_name)}</strong>
                  ${assignment.company_name ? `<br><small class="text-muted">${utils.escapeHtml(assignment.company_name)}</small>` : ''}
                </div>
                <span class="remove-btn" onclick="eventsModule.removeGuestFromTable('${assignment.id}')" title="Remove">
                  <i class="bi bi-x-circle"></i>
                </span>
              </div>
            `).join('') : '<p class="text-muted small text-center mt-3">Drag guests here</p>'}
          </div>
          ${availableSeats === 0 ? '<div class="text-center mt-2"><span class="badge bg-warning">Full</span></div>' : ''}
        </div>
      `;
    }).join('');
  },

  /**
   * Guest Drag Handlers
   */
  handleGuestDragStart(event) {
    const guestItem = event.currentTarget;
    this.draggedGuestId = guestItem.dataset.guestId;
    this.draggedGuestData = {
      guest_id: guestItem.dataset.guestId,
      guest_name: guestItem.dataset.guestName,
      company_name: guestItem.dataset.companyName,
      organisation_id: guestItem.dataset.organisationId
    };
    guestItem.classList.add('dragging');
  },

  handleGuestDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
  },

  /**
   * Table Drag Handlers
   */
  handleTableDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
  },

  handleTableDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
  },

  async handleTableDrop(event, tableId) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    if (!this.draggedGuestData) return;

    try {
      // Find the table
      const table = this.tables.find(t => t.id === tableId);
      if (!table) return;

      // Check if table has available seats
      const assignedCount = table.assignments?.length || 0;
      if (assignedCount >= table.total_seats) {
        utils.showToast('Table is full!', 'warning');
        return;
      }

      // Create assignment
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

      // Reload data
      await this.loadTablePlan();
      this.renderUnassignedGuests();
      this.renderTables();

    } catch (error) {
      console.error('Error assigning guest:', error);
      utils.showToast('Failed to assign guest', 'error');
    } finally {
      this.draggedGuestData = null;
      this.draggedGuestId = null;
    }
  },

  /**
   * Add New Table
   */
  async addNewTable() {
    const seats = prompt('How many seats for this table?', '8');
    if (!seats || isNaN(seats) || seats < 1) return;

    try {
      // Get next table number
      const { data: nextNumber, error: numberError } = await STATE.client
        .rpc('get_next_table_number', {
          p_event_id: this.currentEventIdTablePlan
        });

      if (numberError) throw numberError;

      // Create table
      const { error } = await STATE.client
        .from('event_tables')
        .insert([{
          event_id: this.currentEventIdTablePlan,
          table_number: nextNumber,
          total_seats: parseInt(seats),
          shape: 'round'
        }]);

      if (error) throw error;

      utils.showToast('Table added successfully', 'success');

      // Reload
      await this.loadTablePlan();
      this.renderTables();

    } catch (error) {
      console.error('Error adding table:', error);
      utils.showToast('Failed to add table', 'error');
    }
  },

  /**
   * Delete Table
   */
  async deleteTable(tableId) {
    if (!confirm('Delete this table? Guests will be unassigned.')) return;

    try {
      const { error } = await STATE.client
        .from('event_tables')
        .delete()
        .eq('id', tableId);

      if (error) throw error;

      utils.showToast('Table deleted', 'success');

      // Reload
      await this.loadTablePlan();
      this.renderUnassignedGuests();
      this.renderTables();

    } catch (error) {
      console.error('Error deleting table:', error);
      utils.showToast('Failed to delete table', 'error');
    }
  },

  /**
   * Remove Guest from Table
   */
  async removeGuestFromTable(assignmentId) {
    try {
      const { error } = await STATE.client
        .from('table_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      utils.showToast('Guest removed from table', 'success');

      // Reload
      await this.loadTablePlan();
      this.renderUnassignedGuests();
      this.renderTables();

    } catch (error) {
      console.error('Error removing guest:', error);
      utils.showToast('Failed to remove guest', 'error');
    }
  },

  /**
   * Save Table Plan (currently auto-saves on each action)
   */
  saveTablePlan() {
    utils.showToast('Table plan saved successfully', 'success');
  },

  /**
   * Auto Assign Guests (placeholder)
   */
  autoAssignGuests() {
    utils.showToast('Auto assign feature - Coming soon', 'info');
  },

  /**
   * Export Table Plan
   */
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
            'Guest Name': assignment.guest_name,
            'Company': assignment.company_name || ''
          });
        });
      } else {
        exportData.push({
          'Table Number': table.table_number,
          'Table Name': table.table_name || '',
          'Guest Name': '(Empty)',
          'Company': ''
        });
      }
    });

    const filename = `${this.currentEventNameTablePlan.replace(/[^a-z0-9]/gi, '_')}_table_plan_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  }
};

// Export to window for global access
window.eventsModule = eventsModule;
