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
  }
};

// Export to window for global access
window.eventsModule = eventsModule;
