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

    let html = '';

    this.runningOrderItems.forEach((item, index) => {
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
            <div class="ro-award-name" title="${utils.escapeHtml(awardName)}">${utils.escapeHtml(awardName)}</div>
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
      display_order: item.display_order + 1, // Insert after current item
      award_name: item.award_name ? item.award_name + ' (copy)' : null,
      display_name: item.display_name || null,
      recipient_collecting: item.recipient_collecting || null,
      scheduled_time: null,
      duration_minutes: item.duration_minutes || 3,
      item_type: item.item_type || 'award',
      sponsor: item.sponsor || null,
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
                      </div>
                    ` : ''}
                  ` : ''}
                  ${current?.notes ? `
                    <div style="font-size:0.9rem; color:#888; margin-top:10px; padding-top:10px; border-top:1px solid #0f3460;">
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
                        <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule.exportTablePlan()">
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
  async autoAssignGuests() {
    if (this.unassignedGuests.length === 0) {
      utils.showToast('No unassigned guests to assign', 'info');
      return;
    }

    if (this.tables.length === 0) {
      utils.showToast('No tables available. Add tables first.', 'warning');
      return;
    }

    // Calculate available seats per table
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

    const guestsToAssign = Math.min(this.unassignedGuests.length, totalAvailable);
    if (!confirm(`Auto-assign ${guestsToAssign} guest(s) across ${tablesWithSpace.length} table(s)?\n\nGuests will be distributed evenly across tables with available seats.`)) {
      return;
    }

    try {
      utils.showLoading();
      let assigned = 0;
      let tableIndex = 0;

      // Round-robin assignment to distribute evenly
      for (const guest of this.unassignedGuests) {
        if (assigned >= guestsToAssign) break;

        // Find next table with space
        let attempts = 0;
        while (attempts < tablesWithSpace.length) {
          const table = tablesWithSpace[tableIndex % tablesWithSpace.length];
          if (table.availableSeats > 0) {
            const { error } = await STATE.client
              .from('table_assignments')
              .insert([{
                event_id: this.currentEventIdTablePlan,
                table_id: table.id,
                guest_id: guest.guest_id || guest.id,
                guest_name: guest.guest_name,
                organisation_id: guest.organisation_id || null,
                company_name: guest.company_name || null
              }]);

            if (error) {
              console.error('Error assigning guest:', error);
            } else {
              table.availableSeats--;
              assigned++;
            }
            tableIndex++;
            break;
          }
          tableIndex++;
          attempts++;
        }
      }

      utils.showToast(`Successfully assigned ${assigned} guest(s) to tables`, 'success');

      // Reload data
      await this.loadTablePlan();
      this.renderUnassignedGuests();
      this.renderTables();

    } catch (error) {
      console.error('Error auto-assigning guests:', error);
      utils.showToast('Failed to auto-assign guests: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
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
      const checked = this._selectedEvents.has(event.id) ? 'checked' : '';
      const eName = utils.escapeHtml(event.event_name).replace(/'/g, "\\'");

      return `
        <tr class="fade-in">
          <td><input type="checkbox" class="form-check-input event-checkbox" value="${event.id}" ${checked} onchange="eventsModule.toggleEventSelect('${event.id}', this.checked)"></td>
          <td class="fw-semibold">${utils.escapeHtml(event.event_name)}${!event.venue ? ' <i class="bi bi-exclamation-triangle text-warning small" title="Missing venue"></i>' : ''}</td>
          <td><span class="badge bg-primary">${utils.escapeHtml(String(event.year || '-'))}</span></td>
          <td>${eventDate}</td>
          <td>${utils.escapeHtml(event.venue || '-')}</td>
          <td class="text-center">${attendeeCount > 0 ? `<span class="badge bg-info">${attending}/${attendeeCount}</span>` : '<span class="text-muted small">-</span>'}</td>
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
