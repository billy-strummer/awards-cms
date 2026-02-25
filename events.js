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
      utils.showSkeletonLoading('eventsTableBody', 11);

      // Paginated loading for large event datasets
      let allData = [];
      let evtPage = 0;
      const evtPageSize = 1000;
      let evtHasMore = true;

      while (evtHasMore) {
        const from = evtPage * evtPageSize;
        const to = from + evtPageSize - 1;

        const { data, error } = await STATE.client
          .from('events')
          .select('*')
          .order('event_date', { ascending: false })
          .range(from, to);

        if (error) throw error;

        if (!data || data.length === 0) {
          evtHasMore = false;
        } else {
          allData = allData.concat(data);
          evtPage++;
          if (data.length < evtPageSize) evtHasMore = false;
        }
      }

      STATE.allEvents = allData;
      this.populateYearFilter();
      this._eventAwardCounts = {}; // Clear cache on reload
      this._eventAttendeeCounts = {};

      // Restore saved filters from localStorage
      try {
        const saved = JSON.parse(localStorage.getItem('eventsFilters') || '{}');
        if (saved.search) document.getElementById('eventsSearchBox').value = saved.search;
        if (saved.year) document.getElementById('eventsYearFilter').value = saved.year;
        if (saved.timeStatus) document.getElementById('eventsStatusFilter').value = saved.timeStatus;
        if (saved.eventStatus) document.getElementById('eventsEventStatusFilter').value = saved.eventStatus;
      } catch(e) { console.warn('Failed to restore event filters:', e.message); }

      this.updateEventStats();
      this.filterEvents();
      this.renderFinancialOverview();

      console.log(`✅ Loaded ${STATE.allEvents.length} events`);
      utils.trackDataLoad('events');

    } catch (error) {
      console.error('Error loading events:', error);
      utils.showErrorWithRetry(error, 'loading events', () => this.loadEvents());
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
      utils.showEnhancedEmptyState('eventsTableBody', 11, { icon: 'bi-calendar-event', message: 'No events found', description: 'Create your first event to get started' });
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
    utils.initInlineValidation('eventForm');
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
    utils.initInlineValidation('eventForm');
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
      await utils.protectModalDuringSave('eventModal', async () => {
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
      });
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
    if (!await utils.confirmDialog({ title: 'Delete Event', message: `Are you sure you want to delete "${eventName}"?<br><br>Note: Media associated with this event will NOT be deleted, but will be unlinked from the event.` })) {
      return;
    }

    try {
      utils.showLoading();

      // Save to trash before deleting
      const event = STATE.allEvents?.find(e => e.id === eventId);
      if (event) utils.softDelete('events', event);

      const { error } = await STATE.client
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      utils.showToast('Event deleted. <a href="#" onclick="event.preventDefault(); utils.undoLastDelete(\'events\')">Undo</a>', 'info');
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
    utils.initInlineValidation('cloneEventForm');
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
      await utils.protectModalDuringSave('cloneEventModal', async () => {
        utils.showLoading();

        // Step 1: Create new event (fetch source for capacity)
        const { data: srcEvt } = await STATE.client.from('events').select('capacity').eq('id', sourceEventId).single();
        const newEventData = {
          event_name: newEventName,
          event_date: newEventDate || null,
          year: parseInt(newEventYear),
          venue: newEventVenue || null,
          description: newEventDescription || null,
          event_status: 'draft',
          capacity: srcEvt?.capacity || null
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
      });
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
   * Load templates from Supabase (falls back to localStorage)
   */
  async loadTemplates() {
    try {
      const { data, error } = await STATE.client
        .from('event_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      try {
        const stored = localStorage.getItem('eventTemplates');
        return stored ? JSON.parse(stored) : [];
      } catch (error) {
        console.error('Error loading templates:', error);
        return [];
      }
    }
  },

  /**
   * Save templates to Supabase (falls back to localStorage)
   */
  async saveTemplatesStorage(templates) {
    try {
      await STATE.client.from('event_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (templates.length > 0) {
        const { error } = await STATE.client.from('event_templates').insert(
          templates.map(t => ({ name: t.name, template_data: t, created_by: STATE.currentUser?.email }))
        );
        if (error) throw error;
      }
    } catch (e) {
      try {
        localStorage.setItem('eventTemplates', JSON.stringify(templates));
      } catch (error) {
        console.error('Error saving templates:', error);
        utils.showToast('Error saving templates', 'error');
      }
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
  async renderTemplatesList() {
    const templates = await this.loadTemplates();
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
  async editTemplate(index) {
    const templates = await this.loadTemplates();
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
  async saveTemplate() {
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

    const templates = await this.loadTemplates();

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

    await this.saveTemplatesStorage(templates);
    await this.renderTemplatesList();
    this.cancelTemplateEdit();
  },

  /**
   * Delete template
   */
  async deleteTemplate(index) {
    if (!await utils.confirmDialog({ title: 'Delete Template', message: 'Are you sure you want to delete this template?' })) {
      return;
    }

    const templates = await this.loadTemplates();
    templates.splice(index, 1);
    await this.saveTemplatesStorage(templates);
    await this.renderTemplatesList();
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
    const templates = await this.loadTemplates();
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
   * Get attendees for an event from Supabase
   */
  async getAttendees(eventId) {
    try {
      const { data, error } = await STATE.client
        .from('event_attendees')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // Map DB column names to JS property names used by the UI
      return (data || []).map(row => ({
        id: row.id,
        name: row.attendee_name || row.name || '',
        email: row.attendee_email || row.email || '',
        status: row.rsvp_status || row.status || 'attending',
        dietary: row.meal_preference || row.dietary || '',
        guestType: row.guest_type || row.guestType || 'guest',
        plusOnes: row.plus_ones || row.plusOnes || 0,
        notes: row.notes || '',
        checkedIn: row.checked_in || row.checkedIn || false,
        checkInTime: row.check_in_time || row.checkInTime || null,
        addedAt: row.created_at || row.addedAt || null,
        organisation_id: row.organisation_id || null,
        table_number: row.table_number || null
      }));
    } catch (e) {
      console.error('Error loading attendees:', e);
      // Fallback to localStorage during migration
      const key = `event_attendees_${eventId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    }
  },

  /**
   * Save attendees for an event to Supabase
   */
  async saveAttendees(eventId, attendees) {
    try {
      // Delete existing and re-insert (simple upsert pattern)
      await STATE.client.from('event_attendees').delete().eq('event_id', eventId);
      if (attendees.length > 0) {
        // Map JS property names to DB column names
        const rows = attendees.map(a => ({
          event_id: eventId,
          attendee_name: a.name || '',
          attendee_email: a.email || '',
          rsvp_status: a.status || 'attending',
          meal_preference: a.dietary || '',
          guest_type: a.guestType || 'guest',
          plus_ones: a.plusOnes || 0,
          notes: a.notes || '',
          checked_in: a.checkedIn || false,
          check_in_time: a.checkInTime || null,
          organisation_id: a.organisation_id || null,
          table_number: a.table_number || null
        }));
        const { error } = await STATE.client.from('event_attendees').insert(rows);
        if (error) throw error;
      }
    } catch (e) {
      console.error('Error saving attendees:', e);
      // Fallback to localStorage
      localStorage.setItem(`event_attendees_${eventId}`, JSON.stringify(attendees));
    }
  },

  /**
   * Open attendees modal for an event
   */
  async openAttendeesModal(eventId) {
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
    this.renderWaitlistTab(eventId);
    this.renderBudgetTab(eventId);
    this.renderVendorsTab(eventId);
    this.renderSpecialReqsTab(eventId);
    this.renderMilestonesPanel(eventId);
    this.renderPostEventTab(eventId);

    // Load event notes
    const notesEl = document.getElementById('eventQuickNotes');
    if (notesEl) notesEl.value = await this._getEventNotes(eventId);

    const modal = new bootstrap.Modal(document.getElementById('attendeesModal'));
    modal.show();
  },

  /**
   * Render attendees table with all enhanced fields
   */
  async renderAttendees(eventId) {
    const attendees = await this.getAttendees(eventId);
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
      utils.showEnhancedEmptyState('attendeesTableBody', 8, { icon: 'bi-people', message: 'No attendees yet', description: 'Click "Add Attendee" to start tracking RSVPs' });
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
            ${a.email ? `<button class="btn btn-outline-info btn-sm"
              onclick="eventsModule.sendInviteEmail('${a.id}')"
              title="Send invite" aria-label="Send invite"><i class="bi bi-envelope"></i></button>` : ''}
            <button class="btn btn-outline-primary btn-sm"
              onclick="eventsModule.updateAttendeeStatus('${a.id}', '${a.status === 'attending' ? 'not_attending' : 'attending'}')"
              title="Toggle RSVP" aria-label="Toggle RSVP"><i class="bi bi-arrow-repeat"></i></button>
            <button class="btn btn-outline-danger btn-sm"
              onclick="eventsModule.deleteAttendee('${a.id}')" title="Remove" aria-label="Remove attendee"><i class="bi bi-trash"></i></button>
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

  async exportDietarySummary() {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = (await this.getAttendees(eventId)).filter(a => a.status === 'attending');
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

    let filtered = attendees.filter(a => {
      if (search && !(a.name || '').toLowerCase().includes(search) && !(a.email || '').toLowerCase().includes(search)) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (typeFilter && (a.guestType || 'guest') !== typeFilter) return false;
      return true;
    });

    // Fuzzy search fallback
    if (search && filtered.length === 0) {
      filtered = utils.fuzzyFilter(attendees, search, ['name', 'email']);
      if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter);
      if (typeFilter) filtered = filtered.filter(a => (a.guestType || 'guest') === typeFilter);
    }

    return filtered;
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

  async addAttendee() {
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

    const attendees = await this.getAttendees(eventId);
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

  async updateAttendeeStatus(attendeeId, newStatus) {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = await this.getAttendees(eventId);
    const attendee = attendees.find(a => a.id === attendeeId);
    if (attendee) {
      attendee.status = newStatus;
      this.saveAttendees(eventId, attendees);
      this.renderAttendees(eventId);
      this.renderCheckInTab(eventId);
      utils.showToast('Status updated', 'success');
    }
  },

  async deleteAttendee(attendeeId) {
    if (!await utils.confirmDialog({ title: 'Remove Attendee', message: 'Remove this attendee from the list?', confirmText: 'Remove' })) return;
    const eventId = document.getElementById('attendeesEventId').value;
    let attendees = await this.getAttendees(eventId);
    attendees = attendees.filter(a => a.id !== attendeeId);
    this.saveAttendees(eventId, attendees);
    this.renderAttendees(eventId);
    this.renderCheckInTab(eventId);
    utils.showToast('Attendee removed', 'success');
  },

  // ---- CHECK-IN SYSTEM ----

  async renderCheckInTab(eventId) {
    const attendees = await this.getAttendees(eventId);
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

  async toggleCheckIn(attendeeId) {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = await this.getAttendees(eventId);
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

  async checkInAll() {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = await this.getAttendees(eventId);
    const unchecked = attendees.filter(a => a.status === 'attending' && !a.checkedIn);
    if (unchecked.length === 0) {
      utils.showToast('All attending guests are already checked in', 'info');
      return;
    }
    if (!await utils.confirmDialog({ title: 'Bulk Check In', message: `Check in all ${unchecked.length} attending guest(s)?`, confirmText: 'Check In All', danger: false })) return;
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

  async renderTicketsTab(eventId) {
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    const attendees = await this.getAttendees(eventId);
    const ticketsSold = attendees.filter(a => a.status === 'attending').length;
    const price = event.ticket_price || 0;
    const capacity = event.capacity || 0;
    const ticketData = this._getTicketData(eventId);
    const issuedCount = ticketData.tickets.filter(t => t.status === 'issued').length;

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

    // Render ticket issuance section
    const issuanceContainer = document.getElementById('ticketIssuanceSection');
    if (!issuanceContainer) return;

    const activeTickets = ticketData.tickets.filter(t => t.status === 'issued');
    const revokedTickets = ticketData.tickets.filter(t => t.status === 'revoked');
    const unissued = attendees.filter(a => a.status === 'attending' && !ticketData.tickets.find(t => t.attendeeId === a.id && t.status === 'issued'));

    issuanceContainer.innerHTML = `
      <!-- Ticket Issuance Stats -->
      <div class="row g-3 mb-3">
        <div class="col-md-3"><div class="card text-center"><div class="card-body py-2">
          <h4 class="mb-0 text-primary">${issuedCount}</h4><small class="text-muted">Tickets Issued</small>
        </div></div></div>
        <div class="col-md-3"><div class="card text-center"><div class="card-body py-2">
          <h4 class="mb-0 text-warning">${unissued.length}</h4><small class="text-muted">Awaiting Ticket</small>
        </div></div></div>
        <div class="col-md-3"><div class="card text-center"><div class="card-body py-2">
          <h4 class="mb-0 text-danger">${revokedTickets.length}</h4><small class="text-muted">Revoked</small>
        </div></div></div>
        <div class="col-md-3"><div class="card text-center"><div class="card-body py-2">
          <h4 class="mb-0 text-success">${activeTickets.filter(t => t.checkedIn).length}</h4><small class="text-muted">Checked In</small>
        </div></div></div>
      </div>

      <!-- Batch Issue Actions -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-lightning me-2"></i>Batch Issue Tickets</h6>
          <p class="small text-muted mb-2">Issue tickets to groups of attendees. Tickets include unique reference numbers for check-in.</p>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-primary btn-sm" onclick="eventsModule.batchIssueTickets('confirmed')">
              <i class="bi bi-people me-1"></i>All Confirmed RSVPs (${unissued.length})
            </button>
            <button class="btn btn-warning btn-sm" onclick="eventsModule.batchIssueTickets('vip')">
              <i class="bi bi-star me-1"></i>VIP Guests Only
            </button>
            <button class="btn btn-outline-primary btn-sm" onclick="eventsModule.emailAllTickets()">
              <i class="bi bi-envelope me-1"></i>Email All Tickets
            </button>
            <button class="btn btn-outline-secondary btn-sm" onclick="eventsModule.exportTicketsList()">
              <i class="bi bi-download me-1"></i>Export Tickets CSV
            </button>
          </div>
        </div>
      </div>

      <!-- Individual Ticket Issue -->
      ${unissued.length > 0 ? `
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-person-plus me-2"></i>Issue Individual Tickets</h6>
          <div class="table-responsive" style="max-height:250px; overflow-y:auto;">
            <table class="table table-sm table-hover">
              <thead class="table-light"><tr><th>Name</th><th>Email</th><th>Type</th><th class="text-center">Action</th></tr></thead>
              <tbody>
                ${unissued.map(a => `<tr>
                  <td>${utils.escapeHtml(a.name)}</td>
                  <td>${a.email ? utils.escapeHtml(a.email) : '<span class="text-muted">-</span>'}</td>
                  <td><span class="badge bg-secondary">${(a.guestType || 'guest').toUpperCase()}</span></td>
                  <td class="text-center"><button class="btn btn-sm btn-outline-primary" onclick="eventsModule.issueTicketToAttendee('${a.id}')"><i class="bi bi-ticket-perforated me-1"></i>Issue</button></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>` : ''}

      <!-- Issued Tickets List -->
      ${ticketData.tickets.length > 0 ? `
      <div class="card">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-list-check me-2"></i>Issued Tickets (${ticketData.tickets.length})</h6>
          <div class="table-responsive" style="max-height:300px; overflow-y:auto;">
            <table class="table table-sm table-hover">
              <thead class="table-light"><tr><th>Ticket #</th><th>Attendee</th><th>Email</th><th>Type</th><th>Status</th><th>Issued</th><th class="text-center">Actions</th></tr></thead>
              <tbody>
                ${ticketData.tickets.map(t => `<tr class="${t.status === 'revoked' ? 'text-decoration-line-through text-muted' : ''}">
                  <td><code class="small">${utils.escapeHtml(t.ticketNumber)}</code></td>
                  <td>${utils.escapeHtml(t.attendeeName)}</td>
                  <td>${t.attendeeEmail ? utils.escapeHtml(t.attendeeEmail) : '-'}</td>
                  <td><span class="badge bg-${t.guestType === 'vip' ? 'warning text-dark' : 'secondary'}">${(t.guestType || 'guest').toUpperCase()}</span></td>
                  <td><span class="badge bg-${t.status === 'issued' ? 'success' : 'danger'}">${t.status}</span></td>
                  <td class="small">${t.issuedAt ? new Date(t.issuedAt).toLocaleDateString('en-GB') : '-'}</td>
                  <td class="text-center">
                    ${t.status === 'issued' ? `
                      <button class="btn btn-sm btn-outline-primary me-1" onclick="eventsModule.resendTicket('${t.id}')" title="Email ticket"><i class="bi bi-envelope"></i></button>
                      <button class="btn btn-sm btn-outline-danger" onclick="eventsModule.revokeTicket('${t.id}')" title="Revoke"><i class="bi bi-x-circle"></i></button>
                    ` : '<span class="text-muted small">Revoked</span>'}
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>` : '<div class="text-center text-muted py-3"><i class="bi bi-ticket-perforated fs-1 d-block mb-2 opacity-25"></i>No tickets issued yet. Use the batch issue buttons above to get started.</div>'}`;
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

  // ---- TICKET ISSUANCE SYSTEM ----

  async _getTicketData(eventId) {
    try {
      const { data, error } = await STATE.client
        .from('event_tickets')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return { tickets: data || [], settings: {} };
    } catch (e) {
      console.error('Error loading tickets from DB:', e);
      const stored = localStorage.getItem(`bta_tickets_${eventId}`);
      return stored ? JSON.parse(stored) : { tickets: [], settings: {} };
    }
  },

  async _saveTicketData(eventId, data) {
    try {
      await STATE.client.from('event_tickets').delete().eq('event_id', eventId);
      if (data.tickets && data.tickets.length > 0) {
        const rows = data.tickets.map(t => ({
          event_id: eventId,
          ticket_number: t.ticketNumber || t.ticket_number,
          attendee_id: t.attendeeId || t.attendee_id,
          attendee_name: t.attendeeName || t.attendee_name,
          attendee_email: t.attendeeEmail || t.attendee_email,
          guest_type: t.guestType || t.guest_type || 'guest',
          status: t.status || 'issued',
          issued_at: t.issuedAt || t.issued_at || new Date().toISOString(),
          revoked_at: t.revokedAt || t.revoked_at || null,
          sent_at: t.sentAt || t.sent_at || null
        }));
        await STATE.client.from('event_tickets').insert(rows);
      }
    } catch (e) {
      console.error('Error saving tickets to DB:', e);
      localStorage.setItem(`bta_tickets_${eventId}`, JSON.stringify(data));
    }
  },

  _generateTicketNumber(eventId, index) {
    const year = new Date().getFullYear();
    const prefix = 'BTA';
    const seq = String(index).padStart(4, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${year}-${seq}-${random}`;
  },

  async issueTicketToAttendee(attendeeId) {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const attendees = await this.getAttendees(eventId);
    const attendee = attendees.find(a => a.id === attendeeId);
    if (!attendee || !event) return;

    const ticketData = this._getTicketData(eventId);
    // Check if already issued
    if (ticketData.tickets.find(t => t.attendeeId === attendeeId)) {
      utils.showToast('Ticket already issued to this attendee', 'warning');
      return;
    }

    const ticketNumber = this._generateTicketNumber(eventId, ticketData.tickets.length + 1);
    ticketData.tickets.push({
      id: 'ticket_' + Date.now(),
      ticketNumber,
      attendeeId,
      attendeeName: attendee.name,
      attendeeEmail: attendee.email || '',
      guestType: attendee.guestType || 'guest',
      issuedAt: new Date().toISOString(),
      status: 'issued',
      checkedIn: false
    });

    this._saveTicketData(eventId, ticketData);
    utils.showToast(`Ticket ${ticketNumber} issued to ${attendee.name}`, 'success');
    this.renderTicketsTab(eventId);
  },

  async batchIssueTickets(filter) {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    const attendees = await this.getAttendees(eventId);
    const ticketData = this._getTicketData(eventId);
    const alreadyIssued = new Set(ticketData.tickets.map(t => t.attendeeId));

    let eligible;
    if (filter === 'confirmed') {
      eligible = attendees.filter(a => a.status === 'attending' && !alreadyIssued.has(a.id));
    } else if (filter === 'vip') {
      eligible = attendees.filter(a => (a.guestType === 'vip' || a.vip || a.isVip) && !alreadyIssued.has(a.id));
    } else if (filter === 'winners') {
      // We'll check award data for winners
      eligible = attendees.filter(a => a._isWinner && !alreadyIssued.has(a.id));
    } else {
      eligible = attendees.filter(a => !alreadyIssued.has(a.id));
    }

    if (eligible.length === 0) {
      utils.showToast(alreadyIssued.size > 0 ? 'All eligible attendees already have tickets' : 'No eligible attendees found', 'warning');
      return;
    }

    if (!await utils.confirmDialog({ title: 'Issue Tickets', message: `Issue tickets to ${eligible.length} attendee(s)?`, confirmText: 'Issue Tickets', danger: false })) return;

    let issued = 0;
    eligible.forEach(attendee => {
      const ticketNumber = this._generateTicketNumber(eventId, ticketData.tickets.length + 1);
      ticketData.tickets.push({
        id: 'ticket_' + Date.now() + '_' + issued,
        ticketNumber,
        attendeeId: attendee.id,
        attendeeName: attendee.name,
        attendeeEmail: attendee.email || '',
        guestType: attendee.guestType || 'guest',
        issuedAt: new Date().toISOString(),
        status: 'issued',
        checkedIn: false
      });
      issued++;
    });

    this._saveTicketData(eventId, ticketData);
    utils.showToast(`${issued} ticket(s) issued`, 'success');
    this.renderTicketsTab(eventId);
  },

  async revokeTicket(ticketId) {
    const eventId = document.getElementById('attendeesEventId').value;
    if (!await utils.confirmDialog({ title: 'Revoke Ticket', message: 'Revoke this ticket?', confirmText: 'Revoke' })) return;
    const ticketData = this._getTicketData(eventId);
    const ticket = ticketData.tickets.find(t => t.id === ticketId);
    if (ticket) {
      ticket.status = 'revoked';
      ticket.revokedAt = new Date().toISOString();
      this._saveTicketData(eventId, ticketData);
      this.renderTicketsTab(eventId);
      utils.showToast('Ticket revoked', 'success');
    }
  },

  resendTicket(ticketId) {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const ticketData = this._getTicketData(eventId);
    const ticket = ticketData.tickets.find(t => t.id === ticketId);
    if (!ticket || !ticket.attendeeEmail) {
      utils.showToast('No email address for this ticket holder', 'warning');
      return;
    }

    const subject = `Your Ticket: ${event.event_name} - ${ticket.ticketNumber}`;
    const body = `Dear ${ticket.attendeeName},\n\nPlease find your ticket details below:\n\n` +
      `Event: ${event.event_name}\n` +
      `Date: ${event.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBC'}\n` +
      `Venue: ${event.venue || 'TBC'}\n` +
      `Ticket Number: ${ticket.ticketNumber}\n` +
      `Guest Type: ${(ticket.guestType || 'guest').toUpperCase()}\n\n` +
      `Please present this ticket number at the door. We look forward to seeing you.\n\nBritish Trade Awards`;

    this._showEmailPreview(subject, body, [ticket.attendeeEmail], eventId);
  },

  emailAllTickets() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const ticketData = this._getTicketData(eventId);
    const activeTickets = ticketData.tickets.filter(t => t.status === 'issued' && t.attendeeEmail);

    if (activeTickets.length === 0) {
      utils.showToast('No issued tickets with email addresses', 'warning');
      return;
    }

    const subject = `Your Ticket: ${event.event_name}`;
    const body = `Dear Guest,\n\nYour ticket for ${event.event_name} has been confirmed.\n\n` +
      `Date: ${event.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBC'}\n` +
      `Venue: ${event.venue || 'TBC'}\n\n` +
      `Your individual ticket number will be included in your personalised email.\n` +
      `Please present your ticket at the door.\n\nBritish Trade Awards`;

    this._showEmailPreview(subject, body, activeTickets.map(t => t.attendeeEmail), eventId);
  },

  exportTicketsList() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const ticketData = this._getTicketData(eventId);
    if (ticketData.tickets.length === 0) { utils.showToast('No tickets to export', 'warning'); return; }

    const rows = ticketData.tickets.map(t => ({
      'Ticket Number': t.ticketNumber,
      'Attendee': t.attendeeName,
      'Email': t.attendeeEmail,
      'Type': (t.guestType || 'guest').toUpperCase(),
      'Status': t.status,
      'Issued': t.issuedAt ? new Date(t.issuedAt).toLocaleString('en-GB') : '',
      'Checked In': t.checkedIn ? 'Yes' : 'No'
    }));

    utils.exportToCSV(rows, `${event ? event.event_name.replace(/[^a-z0-9]/gi, '_') : 'event'}_tickets.csv`);
    utils.showToast('Tickets exported', 'success');
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

  async exportAttendees() {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = await this.getAttendees(eventId);

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
  // RSVP INVITATION EMAILS
  // ========================================

  async sendInviteEmail(attendeeId) {
    const eventId = document.getElementById('attendeesEventId').value;
    const attendees = await this.getAttendees(eventId);
    const attendee = attendees.find(a => a.id === attendeeId);
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!attendee || !event) return;
    if (!attendee.email) {
      utils.showToast('No email address for this attendee', 'warning');
      return;
    }

    const regLink = `${this._getBaseUrl()}/register.html?event=${eventId}`;

    // Build email content preview
    const subject = `You're Invited: ${event.event_name}`;
    const body = `Dear ${attendee.name},\n\nYou are cordially invited to ${event.event_name}.\n\n` +
      `Date: ${event.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBC'}\n` +
      `Venue: ${event.venue || 'TBC'}\n\n` +
      `Please confirm your attendance by registering here:\n${regLink}\n\n` +
      `We look forward to seeing you there.\n\nBest regards,\nBritish Trade Awards`;

    // Open compose modal
    this._showEmailPreview(subject, body, [attendee.email], eventId);
  },

  async sendBulkInvites() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    const attendees = await this.getAttendees(eventId);
    const uninvited = attendees.filter(a => a.email && !a._inviteSent);
    if (uninvited.length === 0) {
      utils.showToast('No attendees with email addresses to invite', 'warning');
      return;
    }

    const regLink = `${this._getBaseUrl()}/register.html?event=${eventId}`;
    const subject = `You're Invited: ${event.event_name}`;
    const body = `Dear Guest,\n\nYou are cordially invited to ${event.event_name}.\n\n` +
      `Date: ${event.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBC'}\n` +
      `Venue: ${event.venue || 'TBC'}\n\n` +
      `Please confirm your attendance by registering here:\n${regLink}\n\n` +
      `We look forward to seeing you there.\n\nBest regards,\nBritish Trade Awards`;

    const emails = uninvited.map(a => a.email);
    this._showEmailPreview(subject, body, emails, eventId);
  },

  _showEmailPreview(subject, body, recipients, eventId) {
    const recipientStr = recipients.length > 3 ? `${recipients.slice(0, 3).join(', ')} + ${recipients.length - 3} more` : recipients.join(', ');
    const html = `
      <div class="modal fade" id="emailPreviewModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title"><i class="bi bi-envelope me-2"></i>Send Invitation Email</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label fw-bold">To:</label>
                <div class="form-control bg-light" style="min-height:38px;">${utils.escapeHtml(recipientStr)}</div>
                <small class="text-muted">${recipients.length} recipient${recipients.length > 1 ? 's' : ''}</small>
              </div>
              <div class="mb-3">
                <label class="form-label fw-bold">Subject:</label>
                <input type="text" class="form-control" id="emailSubjectInput" value="${utils.escapeHtml(subject)}">
              </div>
              <div class="mb-3">
                <label class="form-label fw-bold">Message:</label>
                <textarea class="form-control" id="emailBodyInput" rows="12">${utils.escapeHtml(body)}</textarea>
              </div>
              <div class="alert alert-info mb-0">
                <i class="bi bi-info-circle me-2"></i>
                <strong>Send via:</strong> This will open your default email client with the composed message.
                For bulk sends, use the <code>mailto:</code> link or copy content for your email marketing tool.
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" onclick="eventsModule._copyEmailContent()"><i class="bi bi-clipboard me-1"></i>Copy Content</button>
              <button class="btn btn-outline-primary" onclick="eventsModule._downloadMailMerge('${eventId}')"><i class="bi bi-download me-1"></i>Download CSV for Mail Merge</button>
              <button class="btn btn-primary" onclick="eventsModule._openMailto()"><i class="bi bi-send me-1"></i>Open in Email Client</button>
            </div>
          </div>
        </div>
      </div>`;

    // Remove old modal if exists
    const old = document.getElementById('emailPreviewModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    this._emailRecipients = recipients;
    const modal = new bootstrap.Modal(document.getElementById('emailPreviewModal'));
    modal.show();
  },

  _emailRecipients: [],

  _openMailto() {
    const subject = encodeURIComponent(document.getElementById('emailSubjectInput').value);
    const body = encodeURIComponent(document.getElementById('emailBodyInput').value);
    const emails = this._emailRecipients.join(',');
    window.open(`mailto:${emails}?subject=${subject}&body=${body}`, '_self');
    utils.showToast('Email client opened', 'success');
  },

  _copyEmailContent() {
    const subject = document.getElementById('emailSubjectInput').value;
    const body = document.getElementById('emailBodyInput').value;
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    utils.showToast('Email content copied to clipboard', 'success');
  },

  async _downloadMailMerge(eventId) {
    const attendees = await this.getAttendees(eventId);
    const event = STATE.allEvents.find(e => e.id === eventId);
    const regLink = `${this._getBaseUrl()}/register.html?event=${eventId}`;
    const rows = attendees.filter(a => a.email).map(a => ({
      'Name': a.name,
      'Email': a.email,
      'Type': a.guestType || 'guest',
      'Event': event ? event.event_name : '',
      'Date': event ? event.event_date : '',
      'Venue': event ? event.venue : '',
      'Registration Link': regLink
    }));
    utils.exportToCSV(rows, `mail_merge_${event ? event.event_name.replace(/[^a-z0-9]/gi, '_') : 'event'}.csv`);
    utils.showToast('Mail merge CSV downloaded', 'success');
  },

  // ========================================
  // WAITLIST MANAGEMENT
  // ========================================

  _waitlistKey(eventId) {
    return `bta_waitlist_${eventId}`;
  },

  async getWaitlist(eventId) {
    try {
      const { data, error } = await STATE.client
        .from('event_waitlist')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (e) {
      const stored = localStorage.getItem(this._waitlistKey(eventId));
      return stored ? JSON.parse(stored) : [];
    }
  },

  async _saveWaitlist(eventId, waitlist) {
    try {
      await STATE.client.from('event_waitlist').delete().eq('event_id', eventId);
      if (waitlist.length > 0) {
        const rows = waitlist.map(w => ({ ...w, event_id: eventId }));
        await STATE.client.from('event_waitlist').insert(rows);
      }
    } catch (e) {
      localStorage.setItem(this._waitlistKey(eventId), JSON.stringify(waitlist));
    }
  },

  addToWaitlist() {
    const eventId = document.getElementById('attendeesEventId').value;
    const name = prompt('Guest name:');
    if (!name || !name.trim()) return;
    const email = prompt('Email address:');
    const phone = prompt('Phone number (optional):');

    const waitlist = this.getWaitlist(eventId);
    waitlist.push({
      id: 'wl_' + Date.now(),
      name: name.trim(),
      email: (email || '').trim(),
      phone: (phone || '').trim(),
      addedAt: new Date().toISOString(),
      notified: false,
      promoted: false
    });
    this._saveWaitlist(eventId, waitlist);
    this.renderWaitlistTab(eventId);
    utils.showToast(`${name.trim()} added to waitlist`, 'success');
  },

  async removeFromWaitlist(wlId) {
    const eventId = document.getElementById('attendeesEventId').value;
    if (!await utils.confirmDialog({ title: 'Remove from Waitlist', message: 'Remove from waitlist?', confirmText: 'Remove' })) return;
    let waitlist = this.getWaitlist(eventId);
    waitlist = waitlist.filter(w => w.id !== wlId);
    this._saveWaitlist(eventId, waitlist);
    this.renderWaitlistTab(eventId);
    utils.showToast('Removed from waitlist', 'success');
  },

  async promoteFromWaitlist(wlId) {
    const eventId = document.getElementById('attendeesEventId').value;
    const waitlist = this.getWaitlist(eventId);
    const person = waitlist.find(w => w.id === wlId);
    if (!person) return;

    // Add as attendee
    const attendees = await this.getAttendees(eventId);
    attendees.push({
      id: Date.now().toString(),
      name: person.name,
      email: person.email,
      status: 'attending',
      guestType: 'guest',
      plusOnes: 0,
      dietary: '',
      notes: `Promoted from waitlist on ${new Date().toLocaleDateString()}`,
      checkedIn: false,
      checkInTime: null,
      addedAt: new Date().toISOString()
    });
    this.saveAttendees(eventId, attendees);

    // Mark promoted on waitlist
    person.promoted = true;
    person.promotedAt = new Date().toISOString();
    this._saveWaitlist(eventId, waitlist);

    this.renderWaitlistTab(eventId);
    this.renderAttendees(eventId);
    utils.showToast(`${person.name} promoted to attendee list`, 'success');
  },

  renderWaitlistTab(eventId) {
    const container = document.getElementById('waitlistTableBody');
    if (!container) return;
    const waitlist = this.getWaitlist(eventId);
    const countEl = document.getElementById('waitlistCount');
    if (countEl) countEl.textContent = waitlist.filter(w => !w.promoted).length;

    if (waitlist.length === 0) {
      utils.showEmptyState('waitlistTableBody', 6, 'No one on the waitlist', 'bi-person-slash');
      return;
    }

    container.innerHTML = waitlist.map(w => `
      <tr class="${w.promoted ? 'table-success' : ''}">
        <td><strong>${utils.escapeHtml(w.name)}</strong></td>
        <td>${utils.escapeHtml(w.email || '-')}</td>
        <td>${utils.escapeHtml(w.phone || '-')}</td>
        <td>${new Date(w.addedAt).toLocaleDateString()}</td>
        <td>${w.promoted ? '<span class="badge bg-success">Promoted</span>' : '<span class="badge bg-warning">Waiting</span>'}</td>
        <td class="text-center">
          ${w.promoted ? '' : `
            <button class="btn btn-sm btn-success me-1" onclick="eventsModule.promoteFromWaitlist('${w.id}')" title="Promote to attendee">
              <i class="bi bi-person-plus"></i>
            </button>`}
          <button class="btn btn-sm btn-outline-danger" onclick="eventsModule.removeFromWaitlist('${w.id}')" title="Remove">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`).join('');
  },

  // ========================================
  // NAME BADGES & PLACE CARDS (PDF)
  // ========================================

  async generateNameBadges() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const attendees = (await this.getAttendees(eventId)).filter(a => a.status === 'attending');

    if (attendees.length === 0) {
      utils.showToast('No attending guests to generate badges for', 'warning');
      return;
    }

    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      utils.showToast('Loading PDF library...', 'info');
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
      script.onload = () => this._buildBadgesPDF(event, attendees);
      document.head.appendChild(script);
      return;
    }
    this._buildBadgesPDF(event, attendees);
  },

  _buildBadgesPDF(event, attendees) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Badge layout: 2 columns × 4 rows per page = 8 badges per page
    const badgeW = 90, badgeH = 60;
    const marginX = 15, marginY = 15;
    const gapX = 5, gapY = 8;
    const cols = 2, rows = 4;
    const badgesPerPage = cols * rows;

    attendees.forEach((att, idx) => {
      if (idx > 0 && idx % badgesPerPage === 0) doc.addPage();
      const pageIdx = idx % badgesPerPage;
      const col = pageIdx % cols;
      const row = Math.floor(pageIdx / cols);
      const x = marginX + col * (badgeW + gapX);
      const y = marginY + row * (badgeH + gapY);

      // Badge border
      doc.setDrawColor(200);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, badgeW, badgeH, 3, 3);

      // Event name (top)
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(event ? event.event_name : 'Event', x + badgeW / 2, y + 8, { align: 'center' });

      // Guest name (center, large)
      doc.setFontSize(16);
      doc.setTextColor(30);
      doc.setFont(undefined, 'bold');
      doc.text(att.name, x + badgeW / 2, y + 28, { align: 'center', maxWidth: badgeW - 10 });

      // Guest type badge
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      const typeStr = (att.guestType || 'guest').toUpperCase();
      const typeColors = { VIP: [220, 53, 69], SPEAKER: [13, 110, 253], SPONSOR: [25, 135, 84], MEDIA: [111, 66, 193], STAFF: [108, 117, 125], GUEST: [13, 202, 240] };
      const tc = typeColors[typeStr] || typeColors.GUEST;
      doc.setTextColor(tc[0], tc[1], tc[2]);
      doc.text(typeStr, x + badgeW / 2, y + 38, { align: 'center' });

      // Company/org (if in notes or dietary)
      doc.setFontSize(8);
      doc.setTextColor(120);
      if (att.notes) {
        doc.text(att.notes.substring(0, 40), x + badgeW / 2, y + 46, { align: 'center' });
      }

      // Dietary flag
      if (att.dietary) {
        doc.setFontSize(7);
        doc.setTextColor(220, 53, 69);
        doc.text(`Dietary: ${att.dietary}`, x + badgeW / 2, y + 53, { align: 'center', maxWidth: badgeW - 10 });
      }
    });

    doc.save(`${event ? event.event_name.replace(/[^a-z0-9]/gi, '_') : 'event'}_name_badges.pdf`);
    utils.showToast(`Generated ${attendees.length} name badges`, 'success');
  },

  async generatePlaceCards() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const attendees = (await this.getAttendees(eventId)).filter(a => a.status === 'attending');

    if (attendees.length === 0) {
      utils.showToast('No attending guests to generate place cards for', 'warning');
      return;
    }

    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
      script.onload = () => this._buildPlaceCardsPDF(event, attendees);
      document.head.appendChild(script);
      return;
    }
    this._buildPlaceCardsPDF(event, attendees);
  },

  _buildPlaceCardsPDF(event, attendees) {
    const { jsPDF } = window.jspdf;
    // Landscape A4 folded = place card. 2 per row, 3 per page = 6 per page
    const doc = new jsPDF('l', 'mm', 'a4');
    const cardW = 130, cardH = 80;
    const marginX = 15, marginY = 12;
    const gapX = 7, gapY = 7;
    const cols = 2, rows = 2;
    const perPage = cols * rows;

    attendees.forEach((att, idx) => {
      if (idx > 0 && idx % perPage === 0) doc.addPage();
      const pageIdx = idx % perPage;
      const col = pageIdx % cols;
      const row = Math.floor(pageIdx / cols);
      const x = marginX + col * (cardW + gapX);
      const y = marginY + row * (cardH + gapY);

      // Card outline with fold line
      doc.setDrawColor(180);
      doc.setLineWidth(0.3);
      doc.rect(x, y, cardW, cardH);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(x, y + cardH / 2, x + cardW, y + cardH / 2);
      doc.setLineDashPattern([], 0);

      // Top half (visible when folded - guest facing)
      doc.setFontSize(18);
      doc.setTextColor(30);
      doc.setFont(undefined, 'bold');
      doc.text(att.name, x + cardW / 2, y + 20, { align: 'center', maxWidth: cardW - 16 });

      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100);
      if (att.notes) doc.text(att.notes.substring(0, 50), x + cardW / 2, y + 28, { align: 'center' });

      // Dietary icon
      if (att.dietary) {
        doc.setFontSize(8);
        doc.setTextColor(220, 53, 69);
        doc.text(`[${att.dietary}]`, x + cardW / 2, y + 35, { align: 'center' });
      }

      // Bottom half (back - event info for staff)
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(att.name, x + cardW / 2, y + cardH / 2 + 12, { align: 'center' });
      doc.setFontSize(7);
      doc.setTextColor(140);
      const typeStr = (att.guestType || 'guest').toUpperCase();
      doc.text(`${typeStr} | ${event ? event.event_name : ''}`, x + cardW / 2, y + cardH / 2 + 18, { align: 'center' });
      if (att.dietary) {
        doc.text(`Dietary: ${att.dietary}`, x + cardW / 2, y + cardH / 2 + 24, { align: 'center' });
      }
    });

    doc.save(`${event ? event.event_name.replace(/[^a-z0-9]/gi, '_') : 'event'}_place_cards.pdf`);
    utils.showToast(`Generated ${attendees.length} place cards`, 'success');
  },

  // ========================================
  // SHAREABLE SEATING CHART
  // ========================================

  openShareableSeatingChart() {
    const eventId = document.getElementById('attendeesEventId')?.value ||
      this.currentEventIdRunningOrder;
    if (!eventId) {
      utils.showToast('No event selected', 'warning');
      return;
    }

    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    // Build a standalone HTML window with the seating chart
    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) {
      utils.showToast('Please allow popups to view the seating chart', 'warning');
      return;
    }

    this._buildSeatingChartPage(win, event, eventId);
  },

  async _buildSeatingChartPage(win, event, eventId) {
    try {
      const { data: tables } = await STATE.client
        .from('event_tables')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .order('table_number');

      const { data: assignments } = await STATE.client
        .from('table_assignments')
        .select('*')
        .eq('event_id', eventId);

      const tableList = tables || [];
      const assignList = assignments || [];

      const tableCards = tableList.map(t => {
        const seated = assignList.filter(a => a.table_id === t.id);
        const pct = t.total_seats > 0 ? Math.round(seated.length / t.total_seats * 100) : 0;
        const guestListHtml = seated.map(s =>
          `<div style="padding:3px 0;border-bottom:1px solid #eee;font-size:0.85rem;">
            ${s.guest_name || 'Guest'}${s.company_name ? ` <span style="color:#6c757d;">- ${s.company_name}</span>` : ''}
            ${s.is_vip ? ' <span style="background:#dc3545;color:white;padding:1px 6px;border-radius:3px;font-size:0.7rem;">VIP</span>' : ''}
            ${s.dietary_requirements ? ` <span style="color:#fd7e14;font-size:0.75rem;">[${s.dietary_requirements}]</span>` : ''}
          </div>`
        ).join('');

        return `<div style="background:white;border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.08);break-inside:avoid;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;font-size:1.1rem;">${t.table_name || 'Table ' + t.table_number}</h3>
            <span style="background:${pct >= 100 ? '#dc3545' : pct >= 75 ? '#fd7e14' : '#198754'};color:white;padding:2px 10px;border-radius:12px;font-size:0.8rem;">
              ${seated.length}/${t.total_seats} (${pct}%)
            </span>
          </div>
          <div>${guestListHtml || '<div style="color:#6c757d;font-style:italic;">No guests assigned</div>'}</div>
        </div>`;
      }).join('');

      const totalSeated = assignList.length;
      const totalSeats = tableList.reduce((s, t) => s + t.total_seats, 0);

      win.document.write(`<!DOCTYPE html><html><head><title>Seating Chart - ${event.event_name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #f0f2f5; }
          .header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-weight: 800; }
          .header p { margin: 5px 0 0; opacity: 0.7; }
          .stats { display: flex; justify-content: center; gap: 30px; padding: 20px; background: white; border-bottom: 1px solid #eee; }
          .stat { text-align: center; }
          .stat-val { font-size: 1.5rem; font-weight: 700; }
          .grid { columns: 3; column-gap: 20px; padding: 20px; max-width: 1200px; margin: 0 auto; }
          .grid > div { margin-bottom: 20px; }
          @media print { .no-print { display: none; } body { background: white; } .header { background: #1a1a2e !important; -webkit-print-color-adjust: exact; } }
          @media (max-width: 768px) { .grid { columns: 1; } }
        </style></head><body>
        <div class="header">
          <h1>${event.event_name}</h1>
          <p>${event.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''} ${event.venue ? '| ' + event.venue : ''}</p>
        </div>
        <div class="stats">
          <div class="stat"><div class="stat-val">${tableList.length}</div><div>Tables</div></div>
          <div class="stat"><div class="stat-val">${totalSeated}</div><div>Seated</div></div>
          <div class="stat"><div class="stat-val">${totalSeats}</div><div>Total Seats</div></div>
          <div class="stat"><div class="stat-val">${totalSeats > 0 ? Math.round(totalSeated / totalSeats * 100) : 0}%</div><div>Occupancy</div></div>
        </div>
        <div style="text-align:center;padding:12px;" class="no-print">
          <button onclick="window.print()" style="padding:8px 24px;background:#0d6efd;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;">Print Seating Chart</button>
        </div>
        <div class="grid">${tableCards}</div>
        <div style="text-align:center;padding:20px;color:#adb5bd;font-size:0.8rem;">Generated ${new Date().toLocaleString()} | British Trade Awards</div>
      </body></html>`);
      win.document.close();
    } catch (err) {
      console.error('Error building seating chart:', err);
      win.document.write('<h2>Error loading seating chart</h2>');
      win.document.close();
    }
  },

  // ========================================
  // BUDGET TRACKING
  // ========================================

  _budgetKey(eventId) {
    return `bta_budget_${eventId}`;
  },

  async getBudget(eventId) {
    try {
      const [{ data: budgetRow }, { data: items }] = await Promise.all([
        STATE.client.from('event_budgets').select('*').eq('event_id', eventId).single(),
        STATE.client.from('event_budget_items').select('*').eq('event_id', eventId).order('created_at')
      ]);
      return { totalBudget: budgetRow?.total_budget || 0, items: items || [] };
    } catch (e) {
      const stored = localStorage.getItem(this._budgetKey(eventId));
      return stored ? JSON.parse(stored) : { totalBudget: 0, items: [] };
    }
  },

  async _saveBudget(eventId, budget) {
    try {
      // Upsert budget total
      await STATE.client.from('event_budgets').upsert({
        event_id: eventId,
        total_budget: budget.totalBudget || 0
      }, { onConflict: 'event_id' });
      // Replace items
      await STATE.client.from('event_budget_items').delete().eq('event_id', eventId);
      if (budget.items && budget.items.length > 0) {
        const rows = budget.items.map(item => ({
          event_id: eventId,
          name: item.name,
          category: item.category,
          estimated_amount: item.estimatedAmount || item.estimated_amount || 0,
          actual_amount: item.actualAmount || item.actual_amount || 0,
          notes: item.notes
        }));
        await STATE.client.from('event_budget_items').insert(rows);
      }
    } catch (e) {
      console.error('Error saving budget to DB:', e);
      localStorage.setItem(this._budgetKey(eventId), JSON.stringify(budget));
    }
  },

  async renderBudgetTab(eventId) {
    const container = document.getElementById('budgetTableBody');
    if (!container) return;
    const budget = this.getBudget(eventId);
    const items = budget.items || [];

    const totalBudgetEl = document.getElementById('budgetTotalInput');
    if (totalBudgetEl) totalBudgetEl.value = budget.totalBudget || '';

    const totalSpent = items.reduce((s, i) => s + (parseFloat(i.actual) || 0), 0);
    const totalEstimated = items.reduce((s, i) => s + (parseFloat(i.estimated) || 0), 0);
    const totalBudget = parseFloat(budget.totalBudget) || 0;
    const remaining = totalBudget - totalSpent;

    const spentEl = document.getElementById('budgetSpentDisplay');
    const estEl = document.getElementById('budgetEstimatedDisplay');
    const remEl = document.getElementById('budgetRemainingDisplay');
    if (spentEl) spentEl.textContent = `\u00A3${totalSpent.toFixed(2)}`;
    if (estEl) estEl.textContent = `\u00A3${totalEstimated.toFixed(2)}`;
    if (remEl) {
      remEl.textContent = totalBudget > 0 ? `\u00A3${remaining.toFixed(2)}` : '-';
      remEl.className = remaining < 0 ? 'mb-0 text-danger fw-bold' : 'mb-0 text-success fw-bold';
    }

    // Progress bar
    const bar = document.getElementById('budgetProgressBar');
    if (bar && totalBudget > 0) {
      const pct = Math.min(100, Math.round(totalSpent / totalBudget * 100));
      bar.style.width = pct + '%';
      bar.textContent = pct + '%';
      bar.className = `progress-bar ${pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success'}`;
    }

    // Revenue vs Costs summary
    const event = STATE.allEvents.find(e => e.id === eventId);
    const attendees = await this.getAttendees(eventId);
    const attending = attendees ? attendees.filter(a => a.status === 'attending').length : 0;
    const ticketPrice = parseFloat(event?.ticket_price) || 0;
    const ticketRevenue = ticketPrice * attending;
    const netPL = ticketRevenue - totalSpent;

    const revDisplay = document.getElementById('budgetRevenueDisplay');
    const costsDisplay = document.getElementById('budgetCostsTotalDisplay');
    const netDisplay = document.getElementById('budgetNetPLDisplay');

    if (revDisplay) revDisplay.textContent = ticketRevenue > 0 ? `\u00A3${ticketRevenue.toFixed(2)}` : '\u00A30.00';
    if (costsDisplay) costsDisplay.textContent = `\u00A3${totalSpent.toFixed(2)}`;
    if (netDisplay) {
      netDisplay.textContent = `${netPL >= 0 ? '' : '-'}\u00A3${Math.abs(netPL).toFixed(2)}`;
      netDisplay.className = `fw-bold ${netPL >= 0 ? 'text-success' : 'text-danger'}`;
    }

    const categories = ['Venue', 'Catering', 'AV/Production', 'Entertainment', 'Trophies/Awards', 'Print/Stationery', 'Transport', 'Staffing', 'Marketing', 'Gifts/Swag', 'Other'];

    if (items.length === 0) {
      utils.showEnhancedEmptyState('budgetTableBody', 7, { icon: 'bi-calculator', message: 'No budget items', description: 'Click "Add Item" to start tracking' });
      return;
    }

    container.innerHTML = items.map((item, idx) => {
      const diff = (parseFloat(item.actual) || 0) - (parseFloat(item.estimated) || 0);
      const diffClass = diff > 0 ? 'text-danger' : diff < 0 ? 'text-success' : '';
      return `<tr>
        <td><strong>${utils.escapeHtml(item.name)}</strong></td>
        <td><span class="badge bg-secondary">${utils.escapeHtml(item.category || 'Other')}</span></td>
        <td>\u00A3${parseFloat(item.estimated || 0).toFixed(2)}</td>
        <td>\u00A3${parseFloat(item.actual || 0).toFixed(2)}</td>
        <td class="${diffClass}">${diff !== 0 ? (diff > 0 ? '+' : '') + '\u00A3' + diff.toFixed(2) : '-'}</td>
        <td>${utils.escapeHtml(item.status || 'Pending')}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary me-1" onclick="eventsModule.editBudgetItem(${idx})" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="eventsModule.deleteBudgetItem(${idx})" title="Delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  },

  saveBudgetTotal() {
    const eventId = document.getElementById('attendeesEventId').value;
    const budget = this.getBudget(eventId);
    budget.totalBudget = parseFloat(document.getElementById('budgetTotalInput').value) || 0;
    this._saveBudget(eventId, budget);
    this.renderBudgetTab(eventId);
    utils.showToast('Budget total saved', 'success');
  },

  addBudgetItem() {
    const eventId = document.getElementById('attendeesEventId').value;
    const categories = ['Venue', 'Catering', 'AV/Production', 'Entertainment', 'Trophies/Awards', 'Print/Stationery', 'Transport', 'Staffing', 'Marketing', 'Gifts/Swag', 'Other'];
    const html = `
      <div class="modal fade" id="budgetItemModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Add Budget Item</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <div class="mb-3"><label class="form-label">Item Name *</label><input type="text" class="form-control" id="budgetItemName" placeholder="e.g., Venue hire"></div>
              <div class="mb-3"><label class="form-label">Category</label><select class="form-select" id="budgetItemCategory">
                ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
              <div class="row g-3 mb-3">
                <div class="col-6"><label class="form-label">Estimated Cost</label><div class="input-group"><span class="input-group-text">\u00A3</span>
                  <input type="number" class="form-control" id="budgetItemEstimated" step="0.01" min="0" placeholder="0.00"></div></div>
                <div class="col-6"><label class="form-label">Actual Cost</label><div class="input-group"><span class="input-group-text">\u00A3</span>
                  <input type="number" class="form-control" id="budgetItemActual" step="0.01" min="0" placeholder="0.00"></div></div>
              </div>
              <div class="mb-3"><label class="form-label">Status</label><select class="form-select" id="budgetItemStatus">
                <option>Pending</option><option>Quoted</option><option>Booked</option><option>Paid</option><option>Cancelled</option></select></div>
              <div class="mb-3"><label class="form-label">Notes</label><input type="text" class="form-control" id="budgetItemNotes" placeholder="Optional notes"></div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-primary" onclick="eventsModule._saveBudgetItem()"><i class="bi bi-save me-1"></i>Save</button>
            </div>
          </div>
        </div>
      </div>`;
    const old = document.getElementById('budgetItemModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    this._editBudgetIdx = null;
    const modal = new bootstrap.Modal(document.getElementById('budgetItemModal'));
    modal.show();
  },

  _editBudgetIdx: null,

  editBudgetItem(idx) {
    const eventId = document.getElementById('attendeesEventId').value;
    const budget = this.getBudget(eventId);
    const item = budget.items[idx];
    if (!item) return;

    this.addBudgetItem();
    // Populate fields after modal is shown
    setTimeout(() => {
      document.getElementById('budgetItemName').value = item.name || '';
      document.getElementById('budgetItemCategory').value = item.category || 'Other';
      document.getElementById('budgetItemEstimated').value = item.estimated || '';
      document.getElementById('budgetItemActual').value = item.actual || '';
      document.getElementById('budgetItemStatus').value = item.status || 'Pending';
      document.getElementById('budgetItemNotes').value = item.notes || '';
      this._editBudgetIdx = idx;
    }, 200);
  },

  _saveBudgetItem() {
    const eventId = document.getElementById('attendeesEventId').value;
    const name = document.getElementById('budgetItemName').value.trim();
    if (!name) { utils.showToast('Please enter an item name', 'warning'); return; }

    const budget = this.getBudget(eventId);
    const item = {
      name,
      category: document.getElementById('budgetItemCategory').value,
      estimated: parseFloat(document.getElementById('budgetItemEstimated').value) || 0,
      actual: parseFloat(document.getElementById('budgetItemActual').value) || 0,
      status: document.getElementById('budgetItemStatus').value,
      notes: document.getElementById('budgetItemNotes').value.trim()
    };

    if (this._editBudgetIdx !== null) {
      budget.items[this._editBudgetIdx] = item;
    } else {
      budget.items.push(item);
    }
    this._saveBudget(eventId, budget);
    bootstrap.Modal.getInstance(document.getElementById('budgetItemModal')).hide();
    this.renderBudgetTab(eventId);
    utils.showToast(this._editBudgetIdx !== null ? 'Budget item updated' : 'Budget item added', 'success');
    this._editBudgetIdx = null;
  },

  async deleteBudgetItem(idx) {
    if (!await utils.confirmDialog({ title: 'Delete Budget Item', message: 'Delete this budget item?' })) return;
    const eventId = document.getElementById('attendeesEventId').value;
    const budget = this.getBudget(eventId);
    budget.items.splice(idx, 1);
    this._saveBudget(eventId, budget);
    this.renderBudgetTab(eventId);
    utils.showToast('Budget item deleted', 'success');
  },

  exportBudget() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const budget = this.getBudget(eventId);
    if (budget.items.length === 0) { utils.showToast('No budget items to export', 'warning'); return; }

    const rows = budget.items.map(i => ({
      'Item': i.name,
      'Category': i.category || 'Other',
      'Estimated': i.estimated || 0,
      'Actual': i.actual || 0,
      'Variance': ((parseFloat(i.actual) || 0) - (parseFloat(i.estimated) || 0)).toFixed(2),
      'Status': i.status || 'Pending',
      'Notes': i.notes || ''
    }));
    utils.exportToCSV(rows, `${event ? event.event_name.replace(/[^a-z0-9]/gi, '_') : 'event'}_budget.csv`);
  },

  // ========================================
  // VENDOR / SUPPLIER MANAGEMENT
  // ========================================

  _vendorsKey(eventId) {
    return `bta_vendors_${eventId}`;
  },

  async getVendors(eventId) {
    try {
      const { data, error } = await STATE.client
        .from('event_vendors')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (e) {
      const stored = localStorage.getItem(this._vendorsKey(eventId));
      return stored ? JSON.parse(stored) : [];
    }
  },

  async _saveVendors(eventId, vendors) {
    try {
      await STATE.client.from('event_vendors').delete().eq('event_id', eventId);
      if (vendors.length > 0) {
        const rows = vendors.map(v => ({
          event_id: eventId,
          contact_name: v.contact_name || v.contactName,
          company: v.company,
          email: v.email,
          phone: v.phone,
          vendor_type: v.type || v.vendor_type,
          cost: v.cost || 0,
          notes: v.notes
        }));
        await STATE.client.from('event_vendors').insert(rows);
      }
    } catch (e) {
      localStorage.setItem(this._vendorsKey(eventId), JSON.stringify(vendors));
    }
  },

  renderVendorsTab(eventId) {
    const container = document.getElementById('vendorsTableBody');
    if (!container) return;
    const vendors = this.getVendors(eventId);
    const countEl = document.getElementById('vendorCount');
    if (countEl) countEl.textContent = vendors.length;

    if (vendors.length === 0) {
      utils.showEmptyState('vendorsTableBody', 7, 'No vendors/suppliers added yet', 'bi-briefcase');
      return;
    }

    const statusColors = { confirmed: 'success', pending: 'warning', cancelled: 'danger', enquired: 'info' };
    container.innerHTML = vendors.map((v, idx) => `
      <tr>
        <td><strong>${utils.escapeHtml(v.name)}</strong>${v.company ? `<br><small class="text-muted">${utils.escapeHtml(v.company)}</small>` : ''}</td>
        <td><span class="badge bg-secondary">${utils.escapeHtml(v.category || 'Other')}</span></td>
        <td>${v.email ? `<a href="mailto:${utils.escapeHtml(v.email)}">${utils.escapeHtml(v.email)}</a>` : '-'}</td>
        <td>${utils.escapeHtml(v.phone || '-')}</td>
        <td>${v.cost ? '\u00A3' + parseFloat(v.cost).toFixed(2) : '-'}</td>
        <td><span class="badge bg-${statusColors[v.status] || 'secondary'}">${utils.escapeHtml((v.status || 'pending').charAt(0).toUpperCase() + (v.status || 'pending').slice(1))}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary me-1" onclick="eventsModule.editVendor(${idx})" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="eventsModule.deleteVendor(${idx})" title="Delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`).join('');
  },

  addVendor() {
    const categories = ['Venue', 'Catering', 'AV/Production', 'Entertainment', 'Photography', 'Floristry', 'Transport', 'Printing', 'Trophies/Engraving', 'Security', 'Staffing', 'Other'];
    const html = `
      <div class="modal fade" id="vendorModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title"><i class="bi bi-building me-2"></i>Add Vendor/Supplier</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <div class="row g-3 mb-3">
                <div class="col-6"><label class="form-label">Contact Name *</label><input type="text" class="form-control" id="vendorName" placeholder="John Smith"></div>
                <div class="col-6"><label class="form-label">Company</label><input type="text" class="form-control" id="vendorCompany" placeholder="ABC Catering Ltd"></div>
              </div>
              <div class="mb-3"><label class="form-label">Category</label><select class="form-select" id="vendorCategory">
                ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
              <div class="row g-3 mb-3">
                <div class="col-6"><label class="form-label">Email</label><input type="email" class="form-control" id="vendorEmail" placeholder="john@example.com"></div>
                <div class="col-6"><label class="form-label">Phone</label><input type="tel" class="form-control" id="vendorPhone" placeholder="07xxx xxxxxx"></div>
              </div>
              <div class="row g-3 mb-3">
                <div class="col-6"><label class="form-label">Cost</label><div class="input-group"><span class="input-group-text">\u00A3</span>
                  <input type="number" class="form-control" id="vendorCost" step="0.01" min="0" placeholder="0.00"></div></div>
                <div class="col-6"><label class="form-label">Status</label><select class="form-select" id="vendorStatus">
                  <option value="enquired">Enquired</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></div>
              </div>
              <div class="mb-3"><label class="form-label">Notes</label><textarea class="form-control" id="vendorNotes" rows="2" placeholder="Services provided, contract details, etc."></textarea></div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-primary" onclick="eventsModule._saveVendor()"><i class="bi bi-save me-1"></i>Save</button>
            </div>
          </div>
        </div>
      </div>`;
    const old = document.getElementById('vendorModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    this._editVendorIdx = null;
    const modal = new bootstrap.Modal(document.getElementById('vendorModal'));
    modal.show();
  },

  _editVendorIdx: null,

  editVendor(idx) {
    const eventId = document.getElementById('attendeesEventId').value;
    const vendors = this.getVendors(eventId);
    const v = vendors[idx];
    if (!v) return;

    this.addVendor();
    setTimeout(() => {
      document.getElementById('vendorName').value = v.name || '';
      document.getElementById('vendorCompany').value = v.company || '';
      document.getElementById('vendorCategory').value = v.category || 'Other';
      document.getElementById('vendorEmail').value = v.email || '';
      document.getElementById('vendorPhone').value = v.phone || '';
      document.getElementById('vendorCost').value = v.cost || '';
      document.getElementById('vendorStatus').value = v.status || 'pending';
      document.getElementById('vendorNotes').value = v.notes || '';
      this._editVendorIdx = idx;
    }, 200);
  },

  _saveVendor() {
    const eventId = document.getElementById('attendeesEventId').value;
    const name = document.getElementById('vendorName').value.trim();
    if (!name) { utils.showToast('Please enter a contact name', 'warning'); return; }

    const vendors = this.getVendors(eventId);
    const vendor = {
      name,
      company: document.getElementById('vendorCompany').value.trim(),
      category: document.getElementById('vendorCategory').value,
      email: document.getElementById('vendorEmail').value.trim(),
      phone: document.getElementById('vendorPhone').value.trim(),
      cost: parseFloat(document.getElementById('vendorCost').value) || 0,
      status: document.getElementById('vendorStatus').value,
      notes: document.getElementById('vendorNotes').value.trim()
    };

    if (this._editVendorIdx !== null) {
      vendors[this._editVendorIdx] = vendor;
    } else {
      vendors.push(vendor);
    }
    this._saveVendors(eventId, vendors);
    bootstrap.Modal.getInstance(document.getElementById('vendorModal')).hide();
    this.renderVendorsTab(eventId);
    utils.showToast(this._editVendorIdx !== null ? 'Vendor updated' : 'Vendor added', 'success');
    this._editVendorIdx = null;
  },

  async deleteVendor(idx) {
    if (!await utils.confirmDialog({ title: 'Remove Vendor', message: 'Remove this vendor?', confirmText: 'Remove' })) return;
    const eventId = document.getElementById('attendeesEventId').value;
    const vendors = this.getVendors(eventId);
    vendors.splice(idx, 1);
    this._saveVendors(eventId, vendors);
    this.renderVendorsTab(eventId);
    utils.showToast('Vendor removed', 'success');
  },

  exportVendors() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const vendors = this.getVendors(eventId);
    if (vendors.length === 0) { utils.showToast('No vendors to export', 'warning'); return; }
    const rows = vendors.map(v => ({
      'Name': v.name, 'Company': v.company || '', 'Category': v.category || '',
      'Email': v.email || '', 'Phone': v.phone || '', 'Cost': v.cost || 0,
      'Status': v.status || '', 'Notes': v.notes || ''
    }));
    utils.exportToCSV(rows, `${event ? event.event_name.replace(/[^a-z0-9]/gi, '_') : 'event'}_vendors.csv`);
  },

  // ========================================
  // GUEST SPECIAL REQUIREMENTS
  // ========================================

  async renderSpecialReqsTab(eventId) {
    const container = document.getElementById('specialReqsContent');
    if (!container) return;
    const attendees = (await this.getAttendees(eventId)).filter(a => a.status === 'attending');
    const event = STATE.allEvents.find(e => e.id === eventId);
    const reqs = this._getSpecialReqs(eventId);

    // Accessibility summary
    const accessNeeds = attendees.filter(a => {
      const notes = (a.notes || '').toLowerCase();
      return notes.includes('wheelchair') || notes.includes('accessibility') ||
             notes.includes('disabled') || notes.includes('mobility') || notes.includes('hearing') ||
             notes.includes('visual') || notes.includes('step-free');
    });

    const reqsSummary = reqs || { parking: 0, photoConsent: { yes: 0, no: 0, notAsked: 0 }, emergencyContact: '' };

    container.innerHTML = `
      <!-- Accessibility Requirements -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-universal-access me-2"></i>Accessibility Requirements
            <span class="badge bg-info ms-2">${accessNeeds.length} guest${accessNeeds.length !== 1 ? 's' : ''}</span></h6>
          ${accessNeeds.length > 0 ? `
            <div class="table-responsive"><table class="table table-sm">
              <thead><tr><th>Guest</th><th>Type</th><th>Requirement</th></tr></thead>
              <tbody>${accessNeeds.map(a => `<tr>
                <td>${utils.escapeHtml(a.name)}</td>
                <td><span class="badge bg-secondary">${(a.guestType || 'guest').toUpperCase()}</span></td>
                <td>${utils.escapeHtml(a.notes)}</td>
              </tr>`).join('')}</tbody>
            </table></div>
            <div class="alert alert-warning mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Ensure venue provides: step-free access, accessible toilets, hearing loop, reserved seating near exits.</div>
          ` : '<p class="text-muted mb-0">No accessibility requirements flagged. Requirements are detected from guest notes (wheelchair, mobility, hearing, etc.)</p>'}
        </div>
      </div>

      <!-- Parking Passes -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-car-front me-2"></i>Parking Passes</h6>
          <div class="row g-3 align-items-end">
            <div class="col-md-3">
              <label class="form-label small">Passes Available</label>
              <input type="number" class="form-control form-control-sm" id="parkingPassesTotal" value="${reqsSummary.parkingTotal || ''}" min="0" placeholder="0">
            </div>
            <div class="col-md-3">
              <label class="form-label small">Passes Allocated</label>
              <input type="number" class="form-control form-control-sm" id="parkingPassesAllocated" value="${reqsSummary.parkingAllocated || 0}" min="0" placeholder="0">
            </div>
            <div class="col-md-3">
              <label class="form-label small">Remaining</label>
              <div class="form-control form-control-sm bg-light" id="parkingPassesRemaining">${(reqsSummary.parkingTotal || 0) - (reqsSummary.parkingAllocated || 0)}</div>
            </div>
            <div class="col-md-3">
              <button class="btn btn-sm btn-primary w-100" onclick="eventsModule.saveSpecialReqs()"><i class="bi bi-save me-1"></i>Save</button>
            </div>
          </div>
          <div class="mt-2"><small class="text-muted">
            <label class="form-label small">Parking Instructions</label>
            <textarea class="form-control form-control-sm" id="parkingInstructions" rows="2" placeholder="e.g., Valet parking available at main entrance, overflow car park on Oak Street...">${utils.escapeHtml(reqsSummary.parkingInstructions || '')}</textarea>
          </small></div>
        </div>
      </div>

      <!-- Photo Consent -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-camera me-2"></i>Photo/Media Consent Tracking</h6>
          <div class="row g-3 mb-3">
            <div class="col-md-4 text-center">
              <div class="card border-success"><div class="card-body py-2">
                <h4 class="mb-0 text-success" id="photoConsentYes">${reqsSummary.photoConsent?.yes || 0}</h4>
                <small>Consent Given</small>
              </div></div>
            </div>
            <div class="col-md-4 text-center">
              <div class="card border-danger"><div class="card-body py-2">
                <h4 class="mb-0 text-danger" id="photoConsentNo">${reqsSummary.photoConsent?.no || 0}</h4>
                <small>Declined</small>
              </div></div>
            </div>
            <div class="col-md-4 text-center">
              <div class="card border-warning"><div class="card-body py-2">
                <h4 class="mb-0 text-warning" id="photoConsentPending">${attendees.length - (reqsSummary.photoConsent?.yes || 0) - (reqsSummary.photoConsent?.no || 0)}</h4>
                <small>Not Yet Asked</small>
              </div></div>
            </div>
          </div>
          <small class="text-muted">Track consent via the registration form or check-in process. Guests who decline should be flagged to photographers.</small>
        </div>
      </div>

      <!-- Emergency Contacts -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-hospital me-2"></i>Emergency Information</h6>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label small">Emergency Contact Name</label>
              <input type="text" class="form-control form-control-sm" id="emergencyContactName" value="${utils.escapeHtml(reqsSummary.emergencyName || '')}" placeholder="e.g., Event Manager">
            </div>
            <div class="col-md-6">
              <label class="form-label small">Emergency Contact Phone</label>
              <input type="tel" class="form-control form-control-sm" id="emergencyContactPhone" value="${utils.escapeHtml(reqsSummary.emergencyPhone || '')}" placeholder="07xxx xxxxxx">
            </div>
            <div class="col-md-6">
              <label class="form-label small">Nearest Hospital / A&E</label>
              <input type="text" class="form-control form-control-sm" id="nearestHospital" value="${utils.escapeHtml(reqsSummary.nearestHospital || '')}" placeholder="e.g., Royal London Hospital, 10 min drive">
            </div>
            <div class="col-md-6">
              <label class="form-label small">First Aider on Site</label>
              <input type="text" class="form-control form-control-sm" id="firstAider" value="${utils.escapeHtml(reqsSummary.firstAider || '')}" placeholder="Name and location">
            </div>
          </div>
          <div class="mt-2 text-end">
            <button class="btn btn-sm btn-primary" onclick="eventsModule.saveSpecialReqs()"><i class="bi bi-save me-1"></i>Save Emergency Info</button>
          </div>
        </div>
      </div>

      <!-- Dress Code -->
      <div class="card">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-suit-heart me-2"></i>Dress Code & Event Info</h6>
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label small">Dress Code</label>
              <select class="form-select form-select-sm" id="dressCode">
                <option value="">Not specified</option>
                <option value="Black Tie" ${reqsSummary.dressCode === 'Black Tie' ? 'selected' : ''}>Black Tie</option>
                <option value="Formal" ${reqsSummary.dressCode === 'Formal' ? 'selected' : ''}>Formal</option>
                <option value="Smart Casual" ${reqsSummary.dressCode === 'Smart Casual' ? 'selected' : ''}>Smart Casual</option>
                <option value="Business" ${reqsSummary.dressCode === 'Business' ? 'selected' : ''}>Business</option>
                <option value="Casual" ${reqsSummary.dressCode === 'Casual' ? 'selected' : ''}>Casual</option>
                <option value="Theme" ${reqsSummary.dressCode === 'Theme' ? 'selected' : ''}>Theme/Costume</option>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label small">Arrival Time</label>
              <input type="time" class="form-control form-control-sm" id="arrivalTime" value="${reqsSummary.arrivalTime || ''}">
            </div>
            <div class="col-md-4">
              <label class="form-label small">Ceremony Starts</label>
              <input type="time" class="form-control form-control-sm" id="ceremonyTime" value="${reqsSummary.ceremonyTime || ''}">
            </div>
          </div>
          <div class="mt-2 text-end">
            <button class="btn btn-sm btn-primary" onclick="eventsModule.saveSpecialReqs()"><i class="bi bi-save me-1"></i>Save</button>
          </div>
        </div>
      </div>`;
  },

  _specialReqsKey(eventId) {
    return `bta_special_reqs_${eventId}`;
  },

  async _getSpecialReqs(eventId) {
    try {
      const { data, error } = await STATE.client
        .from('event_special_requirements')
        .select('*')
        .eq('event_id', eventId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || {};
    } catch (e) {
      const stored = localStorage.getItem(this._specialReqsKey(eventId));
      return stored ? JSON.parse(stored) : {};
    }
  },

  async saveSpecialReqs() {
    const eventId = document.getElementById('attendeesEventId').value;
    const reqs = {
      parkingTotal: parseInt(document.getElementById('parkingPassesTotal')?.value) || 0,
      parkingAllocated: parseInt(document.getElementById('parkingPassesAllocated')?.value) || 0,
      parkingInstructions: document.getElementById('parkingInstructions')?.value || '',
      photoConsent: {
        yes: parseInt(document.getElementById('photoConsentYes')?.textContent) || 0,
        no: parseInt(document.getElementById('photoConsentNo')?.textContent) || 0
      },
      emergencyName: document.getElementById('emergencyContactName')?.value || '',
      emergencyPhone: document.getElementById('emergencyContactPhone')?.value || '',
      nearestHospital: document.getElementById('nearestHospital')?.value || '',
      firstAider: document.getElementById('firstAider')?.value || '',
      dressCode: document.getElementById('dressCode')?.value || '',
      arrivalTime: document.getElementById('arrivalTime')?.value || '',
      ceremonyTime: document.getElementById('ceremonyTime')?.value || ''
    };
    try {
      const { error } = await STATE.client
        .from('event_special_requirements')
        .upsert({ event_id: eventId, requirements: reqs }, { onConflict: 'event_id' });
      if (error) throw error;
    } catch (e) {
      localStorage.setItem(this._specialReqsKey(eventId), JSON.stringify(reqs));
    }
    utils.showToast('Special requirements saved', 'success');
  },

  // ========================================
  // STRIPE INTEGRATION FOR REGISTRATION
  // ========================================

  _stripePublicKey: null,

  async getStripePublicKey() {
    try {
      const { data, error } = await STATE.client
        .from('user_preferences')
        .select('value')
        .eq('key', 'stripe_public_key')
        .maybeSingle();
      if (error) throw error;
      return data?.value || '';
    } catch (e) {
      return localStorage.getItem('bta_stripe_pk') || '';
    }
  },

  async saveStripeKey() {
    const key = document.getElementById('stripePublicKeyInput')?.value?.trim();
    if (key) {
      try {
        const { error } = await STATE.client
          .from('user_preferences')
          .upsert({ key: 'stripe_public_key', value: key, user_email: STATE.currentUser?.email }, { onConflict: 'key' });
        if (error) throw error;
      } catch (e) {
        localStorage.setItem('bta_stripe_pk', key);
      }
      utils.showToast('Stripe key saved', 'success');
    }
  },

  // ========================================
  // POST-EVENT: MASTER RENDER
  // ========================================

  async renderPostEventTab(eventId) {
    const container = document.getElementById('postEventContent');
    if (!container) return;
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    const isComplete = event.event_status === 'complete';
    const isPast = event.event_date && new Date(event.event_date) < new Date();

    // Pre-fetch async data
    const postEventData = await this._getPostEventData(eventId);
    const surveyStatsHtml = await this._renderSurveyStats(eventId);

    container.innerHTML = `
      ${!isComplete && !isPast ? `<div class="alert alert-info mb-3"><i class="bi bi-info-circle me-2"></i>This event hasn't happened yet. Post-event features are available after the event date or when status is set to "Complete".</div>` : ''}

      <!-- Quick Actions -->
      <div class="card mb-3 border-primary">
        <div class="card-body py-2">
          <h6 class="mb-2"><i class="bi bi-lightning me-2"></i>Quick Actions</h6>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-primary btn-sm" onclick="eventsModule.sendThankYouEmails()" title="Opens email compose with thank-you template for all attending guests"><i class="bi bi-envelope-heart me-1"></i>Send Thank You Emails</button>
            <button class="btn btn-outline-primary btn-sm" onclick="eventsModule.generateAttendanceReport()" title="Downloads attendance report as CSV spreadsheet"><i class="bi bi-download me-1"></i>Download Attendance Report</button>
            <button class="btn btn-outline-success btn-sm" onclick="eventsModule.generateWinnerPackage()" title="Jump to Winner Highlights section below"><i class="bi bi-stars me-1"></i>Winner Highlights</button>
            <button class="btn btn-outline-warning btn-sm" onclick="eventsModule.generateWinnersCertificates()" title="Generate PDF certificates for all confirmed winners"><i class="bi bi-file-earmark-pdf me-1"></i>Winner Certificates PDF</button>
            <button class="btn btn-outline-info btn-sm" onclick="eventsModule.generateSponsorReport()" title="Jump to Sponsor ROI section below"><i class="bi bi-graph-up me-1"></i>Sponsor ROI Report</button>
            <button class="btn btn-outline-secondary btn-sm" onclick="eventsModule.exportPostEventPack()" title="Downloads all reports (attendance, budget, vendors, debrief, sponsor) as CSV files"><i class="bi bi-file-earmark-zip me-1"></i>Export Full Pack</button>
          </div>
        </div>
      </div>

      <!-- Survey / Feedback -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="card-title mb-0"><i class="bi bi-chat-square-text me-2"></i>Post-Event Survey & Feedback</h6>
            <button class="btn btn-sm btn-primary" onclick="eventsModule.sendSurveyEmails()"><i class="bi bi-send me-1"></i>Send Survey</button>
          </div>
          <div id="surveyConfig">
            <div class="row g-3 mb-3">
              <div class="col-md-8">
                <label class="form-label small">Survey Link (Google Forms, Typeform, etc.)</label>
                <input type="text" class="form-control form-control-sm" id="postEventSurveyUrl" placeholder="https://forms.google.com/..." value="${utils.escapeHtml(postEventData.surveyUrl || '')}">
              </div>
              <div class="col-md-4">
                <label class="form-label small">&nbsp;</label>
                <button class="btn btn-sm btn-outline-primary w-100" onclick="eventsModule.savePostEventData()"><i class="bi bi-save me-1"></i>Save</button>
              </div>
            </div>
            <div class="row g-3" id="surveyResponseStats">
              ${surveyStatsHtml}
            </div>
          </div>
        </div>
      </div>

      <!-- Attendance Report -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-bar-chart-line me-2"></i>Attendance Report</h6>
          <div id="attendanceReportContent">
            ${this._renderAttendanceReport(eventId)}
          </div>
        </div>
      </div>

      <!-- Winner Highlights -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="card-title mb-0"><i class="bi bi-stars me-2"></i>Winner Highlights & Social Assets</h6>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" onclick="eventsModule.generatePressRelease()"><i class="bi bi-newspaper me-1"></i>Press Release</button>
              <button class="btn btn-sm btn-outline-success" onclick="eventsModule.generateSocialCards()"><i class="bi bi-share me-1"></i>Social Cards</button>
            </div>
          </div>
          <div id="winnerHighlightsContent">
            ${this._renderWinnerHighlights(eventId)}
          </div>
        </div>
      </div>

      <!-- Sponsor ROI Report -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-graph-up me-2"></i>Sponsor ROI Report</h6>
          <div id="sponsorROIContent">
            ${this._renderSponsorReport(eventId)}
          </div>
        </div>
      </div>

      <!-- Event Debrief -->
      <div class="card">
        <div class="card-body">
          <h6 class="card-title"><i class="bi bi-journal-text me-2"></i>Event Debrief & Lessons Learned</h6>
          <div id="debriefContent">
            ${this._renderDebrief(eventId)}
          </div>
        </div>
      </div>`;
  },

  // ========================================
  // POST-EVENT: DATA STORAGE
  // ========================================

  _postEventKey(eventId) {
    return `bta_post_event_${eventId}`;
  },

  async _getPostEventData(eventId) {
    try {
      const { data, error } = await STATE.client
        .from('event_post_data')
        .select('*')
        .eq('event_id', eventId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.post_data || {};
    } catch (e) {
      const stored = localStorage.getItem(this._postEventKey(eventId));
      return stored ? JSON.parse(stored) : {};
    }
  },

  async _savePostEventDataStore(eventId, data) {
    try {
      const { error } = await STATE.client
        .from('event_post_data')
        .upsert({ event_id: eventId, post_data: data }, { onConflict: 'event_id' });
      if (error) throw error;
    } catch (e) {
      localStorage.setItem(this._postEventKey(eventId), JSON.stringify(data));
    }
  },

  async savePostEventData() {
    const eventId = document.getElementById('attendeesEventId').value;
    const data = await this._getPostEventData(eventId);
    data.surveyUrl = document.getElementById('postEventSurveyUrl')?.value || '';
    data.surveyResponses = parseInt(document.getElementById('surveyResponseCount')?.value) || data.surveyResponses || 0;
    await this._savePostEventDataStore(eventId, data);
    utils.showToast('Post-event data saved', 'success');
  },

  // ========================================
  // POST-EVENT: SURVEY & FEEDBACK
  // ========================================

  async _renderSurveyStats(eventId) {
    const data = await this._getPostEventData(eventId);
    const attendees = await this.getAttendees(eventId);
    const attending = attendees.filter(a => a.status === 'attending').length;
    const responses = data.surveyResponses || 0;
    const rate = attending > 0 ? Math.round(responses / attending * 100) : 0;

    return `
      <div class="col-md-3"><div class="card text-center"><div class="card-body py-2">
        <h4 class="mb-0">${attending}</h4><small class="text-muted">Attended</small>
      </div></div></div>
      <div class="col-md-3"><div class="card text-center"><div class="card-body py-2">
        <div class="input-group input-group-sm">
          <input type="number" class="form-control text-center fw-bold" id="surveyResponseCount" value="${responses}" min="0" onchange="eventsModule.savePostEventData()">
        </div>
        <small class="text-muted">Responses</small>
      </div></div></div>
      <div class="col-md-3"><div class="card text-center"><div class="card-body py-2">
        <h4 class="mb-0 ${rate >= 50 ? 'text-success' : rate >= 25 ? 'text-warning' : 'text-danger'}">${rate}%</h4><small class="text-muted">Response Rate</small>
      </div></div></div>
      <div class="col-md-3"><div class="card text-center"><div class="card-body py-2">
        <div class="input-group input-group-sm">
          <input type="number" class="form-control text-center fw-bold" id="surveyAvgRating" value="${data.avgRating || ''}" min="1" max="10" step="0.1" placeholder="-" onchange="eventsModule.savePostEventData()">
          <span class="input-group-text">/10</span>
        </div>
        <small class="text-muted">Avg Rating</small>
      </div></div></div>`;
  },

  async sendSurveyEmails() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const data = await this._getPostEventData(eventId);
    if (!data.surveyUrl) {
      utils.showToast('Please add a survey URL first', 'warning');
      return;
    }

    const attendees = (await this.getAttendees(eventId)).filter(a => a.status === 'attending' && a.email);
    if (attendees.length === 0) {
      utils.showToast('No attendees with email addresses', 'warning');
      return;
    }

    const subject = `How was ${event.event_name}? We'd love your feedback`;
    const body = `Dear Guest,\n\nThank you for attending ${event.event_name}. We hope you had a wonderful evening.\n\nWe would greatly appreciate your feedback to help us improve future events. It only takes 2 minutes:\n\n${data.surveyUrl}\n\nYour responses are anonymous and will directly shape our upcoming events.\n\nThank you,\nBritish Trade Awards`;

    this._showEmailPreview(subject, body, attendees.map(a => a.email), eventId);
  },

  async sendThankYouEmails() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const attendees = (await this.getAttendees(eventId)).filter(a => a.status === 'attending' && a.email);

    if (attendees.length === 0) {
      utils.showToast('No attendees with email addresses', 'warning');
      return;
    }

    const subject = `Thank You for Attending ${event.event_name}`;
    const body = `Dear Guest,\n\nThank you for joining us at ${event.event_name}. It was a fantastic evening and we were delighted to have you with us.\n\nPhotos from the event will be available soon in our gallery.\n\nWe look forward to welcoming you to future British Trade Awards events.\n\nWith best wishes,\nBritish Trade Awards Team`;

    this._showEmailPreview(subject, body, attendees.map(a => a.email), eventId);
  },

  // ========================================
  // POST-EVENT: ATTENDANCE REPORT
  // ========================================

  async _renderAttendanceReport(eventId) {
    const attendees = await this.getAttendees(eventId);
    const event = STATE.allEvents.find(e => e.id === eventId);
    const attending = attendees.filter(a => a.status === 'attending');
    const checkedIn = attendees.filter(a => a.checkedIn);
    const noShows = attending.filter(a => !a.checkedIn);
    const capacity = event?.capacity || 0;

    // Check-in time distribution
    const checkInTimes = checkedIn
      .filter(a => a.checkInTime)
      .map(a => new Date(a.checkInTime))
      .sort((a, b) => a - b);

    let timeDistribution = '';
    if (checkInTimes.length > 0) {
      const first = checkInTimes[0];
      const last = checkInTimes[checkInTimes.length - 1];
      const peak = this._findPeakCheckInHour(checkInTimes);
      timeDistribution = `
        <div class="col-md-4"><small class="text-muted d-block">First Check-In</small><strong>${first.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong></div>
        <div class="col-md-4"><small class="text-muted d-block">Peak Hour</small><strong>${peak}</strong></div>
        <div class="col-md-4"><small class="text-muted d-block">Last Check-In</small><strong>${last.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong></div>`;
    }

    // Type breakdown
    const typeBreakdown = {};
    attending.forEach(a => {
      const type = (a.guestType || 'guest').toUpperCase();
      typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
    });

    const totalPlusOnes = attending.reduce((s, a) => s + (a.plusOnes || 0), 0);

    return `
      <div class="row g-3 mb-3">
        <div class="col-md-2"><div class="card text-center bg-light"><div class="card-body py-2">
          <h4 class="mb-0">${attendees.length}</h4><small class="text-muted">Total Invited</small>
        </div></div></div>
        <div class="col-md-2"><div class="card text-center bg-light"><div class="card-body py-2">
          <h4 class="mb-0 text-success">${attending.length}</h4><small class="text-muted">RSVP Yes</small>
        </div></div></div>
        <div class="col-md-2"><div class="card text-center bg-light"><div class="card-body py-2">
          <h4 class="mb-0 text-primary">${checkedIn.length}</h4><small class="text-muted">Checked In</small>
        </div></div></div>
        <div class="col-md-2"><div class="card text-center bg-light"><div class="card-body py-2">
          <h4 class="mb-0 text-danger">${noShows.length}</h4><small class="text-muted">No-Shows</small>
        </div></div></div>
        <div class="col-md-2"><div class="card text-center bg-light"><div class="card-body py-2">
          <h4 class="mb-0 text-info">${totalPlusOnes}</h4><small class="text-muted">Plus-Ones</small>
        </div></div></div>
        <div class="col-md-2"><div class="card text-center bg-light"><div class="card-body py-2">
          <h4 class="mb-0">${attending.length > 0 ? Math.round(checkedIn.length / attending.length * 100) : 0}%</h4><small class="text-muted">Show Rate</small>
        </div></div></div>
      </div>

      ${capacity > 0 ? `
      <div class="mb-3">
        <div class="d-flex justify-content-between mb-1">
          <small>Venue Utilisation</small>
          <small>${checkedIn.length + totalPlusOnes} / ${capacity} (${Math.round((checkedIn.length + totalPlusOnes) / capacity * 100)}%)</small>
        </div>
        <div class="progress" style="height:8px;">
          <div class="progress-bar bg-success" style="width:${Math.min(100, Math.round((checkedIn.length + totalPlusOnes) / capacity * 100))}%"></div>
        </div>
      </div>` : ''}

      ${timeDistribution ? `<div class="card bg-light mb-3"><div class="card-body py-2"><h6 class="mb-2"><i class="bi bi-clock me-2"></i>Check-In Timeline</h6><div class="row">${timeDistribution}</div></div></div>` : ''}

      <div class="card bg-light mb-3"><div class="card-body py-2">
        <h6 class="mb-2"><i class="bi bi-people me-2"></i>Guest Type Breakdown</h6>
        <div class="d-flex gap-3 flex-wrap">
          ${Object.entries(typeBreakdown).map(([type, count]) => {
            const colors = { VIP: 'warning', SPEAKER: 'primary', SPONSOR: 'success', MEDIA: 'purple', STAFF: 'secondary', GUEST: 'info' };
            return `<span class="badge bg-${colors[type] || 'secondary'}" ${type === 'MEDIA' ? 'style="background:#6f42c1!important;"' : ''}>${type}: ${count}</span>`;
          }).join('')}
        </div>
      </div></div>

      ${noShows.length > 0 ? `
      <details class="mb-2">
        <summary class="text-danger" style="cursor:pointer;"><strong>${noShows.length} No-Shows</strong> (click to expand)</summary>
        <div class="table-responsive mt-2"><table class="table table-sm"><thead><tr><th>Name</th><th>Email</th><th>Type</th></tr></thead>
        <tbody>${noShows.map(a => `<tr><td>${utils.escapeHtml(a.name)}</td><td>${a.email || '-'}</td><td>${(a.guestType || 'guest').toUpperCase()}</td></tr>`).join('')}</tbody></table></div>
      </details>` : ''}`;
  },

  _findPeakCheckInHour(times) {
    const hourCounts = {};
    times.forEach(t => {
      const h = t.getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const peak = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    return peak ? `${String(peak[0]).padStart(2, '0')}:00 - ${String(parseInt(peak[0]) + 1).padStart(2, '0')}:00` : '-';
  },

  async generateAttendanceReport() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const attendees = await this.getAttendees(eventId);

    const rows = attendees.map(a => ({
      'Name': a.name,
      'Email': a.email || '',
      'Type': (a.guestType || 'guest').toUpperCase(),
      'RSVP': a.status || '',
      'Plus Ones': a.plusOnes || 0,
      'Checked In': a.checkedIn ? 'Yes' : 'No',
      'Check-In Time': a.checkInTime ? new Date(a.checkInTime).toLocaleString() : '',
      'Dietary': a.dietary || '',
      'No Show': a.status === 'attending' && !a.checkedIn ? 'YES' : ''
    }));

    utils.exportToCSV(rows, `${event ? event.event_name.replace(/[^a-z0-9]/gi, '_') : 'event'}_attendance_report.csv`);
    utils.showToast('Attendance report exported', 'success');
  },

  // ========================================
  // POST-EVENT: WINNER HIGHLIGHTS
  // ========================================

  _renderWinnerHighlights(eventId) {
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return '<p class="text-muted">No event data</p>';

    return `
      <p class="text-muted mb-3">Generate shareable assets to celebrate your winners and promote the awards.</p>
      <div class="row g-3">
        <div class="col-md-4">
          <div class="card text-center h-100" style="cursor:pointer;" onclick="eventsModule.generatePressRelease()">
            <div class="card-body py-3">
              <i class="bi bi-newspaper display-4 text-primary mb-2 d-block"></i>
              <h6>Press Release</h6>
              <small class="text-muted">Ready-to-send press release template with all winners listed</small>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center h-100" style="cursor:pointer;" onclick="eventsModule.generateSocialCards()">
            <div class="card-body py-3">
              <i class="bi bi-share display-4 text-success mb-2 d-block"></i>
              <h6>Social Media Cards</h6>
              <small class="text-muted">Generate winner announcement cards for Twitter, LinkedIn, Instagram</small>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center h-100" style="cursor:pointer;" onclick="eventsModule.generateWinnersCertificates()">
            <div class="card-body py-3">
              <i class="bi bi-award display-4 text-warning mb-2 d-block"></i>
              <h6>Winner Certificates</h6>
              <small class="text-muted">PDF certificates for each winner to download and display</small>
            </div>
          </div>
        </div>
      </div>`;
  },

  async generatePressRelease() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    // Load winners for this event's year
    let winners = [];
    try {
      const { data } = await STATE.client
        .from('award_assignments')
        .select('*, awards:award_years(award_name), organisations(company_name)')
        .eq('year', event.year)
        .eq('assignment_type', 'winner');
      winners = data || [];
    } catch (e) { console.error(e); }

    const dateStr = event.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '[DATE]';

    let pressRelease = `PRESS RELEASE\nFOR IMMEDIATE RELEASE\n\n`;
    pressRelease += `BRITISH TRADE AWARDS ${event.year || ''} WINNERS ANNOUNCED\n\n`;
    pressRelease += `${event.venue || '[VENUE]'}, ${dateStr}\n\n`;
    pressRelease += `The British Trade Awards are delighted to announce the winners of the ${event.event_name}.\n\n`;
    pressRelease += `The ceremony, held at ${event.venue || '[VENUE]'} on ${dateStr}, brought together the best in British trade to celebrate outstanding achievement and excellence across the industry.\n\n`;

    if (winners.length > 0) {
      pressRelease += `THE WINNERS:\n\n`;
      winners.forEach(w => {
        pressRelease += `${w.awards?.award_name || 'Award'}: ${w.organisations?.company_name || 'Winner'}\n`;
      });
      pressRelease += `\n`;
    }

    pressRelease += `For more information, high-resolution photos, or interview requests, please contact:\n`;
    pressRelease += `[Contact Name]\n[Email]\n[Phone]\n\n`;
    pressRelease += `--- ENDS ---\n\nNotes to Editors:\n`;
    pressRelease += `The British Trade Awards celebrate excellence in British trade and commerce.\n`;
    pressRelease += `For more information visit: [website]\n`;

    // Show in a modal for copying
    const html = `
      <div class="modal fade" id="pressReleaseModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title"><i class="bi bi-newspaper me-2"></i>Press Release</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <textarea class="form-control" id="pressReleaseText" rows="25" style="font-family:monospace;font-size:0.85rem;">${utils.escapeHtml(pressRelease)}</textarea>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" onclick="navigator.clipboard.writeText(document.getElementById('pressReleaseText').value); utils.showToast('Copied to clipboard','success')"><i class="bi bi-clipboard me-1"></i>Copy</button>
              <button class="btn btn-primary" onclick="const b=new Blob([document.getElementById('pressReleaseText').value],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='press_release_${event.event_name.replace(/[^a-z0-9]/gi, '_')}.txt'; a.click()"><i class="bi bi-download me-1"></i>Download .txt</button>
            </div>
          </div>
        </div>
      </div>`;
    const old = document.getElementById('pressReleaseModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    new bootstrap.Modal(document.getElementById('pressReleaseModal')).show();
  },

  async generateSocialCards() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    let winners = [];
    try {
      const { data } = await STATE.client
        .from('award_assignments')
        .select('*, awards:award_years(award_name), organisations(company_name)')
        .eq('year', event.year)
        .eq('assignment_type', 'winner');
      winners = data || [];
    } catch (e) { console.error(e); }

    if (winners.length === 0) {
      utils.showToast('No winners found for this event year', 'warning');
      return;
    }

    // Generate social card images using Canvas
    const cards = winners.map(w => ({
      award: w.awards?.award_name || 'Award',
      winner: w.organisations?.company_name || 'Winner',
      event: event.event_name,
      year: event.year
    }));

    // Build preview modal
    const cardsHtml = cards.map((card, idx) => `
      <div class="col-md-6 mb-3">
        <canvas id="socialCard${idx}" width="1200" height="630" style="width:100%;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);"></canvas>
        <div class="text-center mt-1">
          <button class="btn btn-sm btn-outline-primary" onclick="eventsModule._downloadSocialCard(${idx})"><i class="bi bi-download me-1"></i>Download</button>
        </div>
      </div>`).join('');

    const html = `
      <div class="modal fade" id="socialCardsModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title"><i class="bi bi-share me-2"></i>Social Media Cards (${cards.length})</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <div class="alert alert-info mb-3"><i class="bi bi-info-circle me-2"></i>Cards are 1200x630px (optimal for LinkedIn/Twitter). Download individually or all at once.</div>
              <div class="row">${cardsHtml}</div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary" onclick="eventsModule._downloadAllSocialCards(${cards.length})"><i class="bi bi-download me-1"></i>Download All</button>
            </div>
          </div>
        </div>
      </div>`;
    const old = document.getElementById('socialCardsModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    new bootstrap.Modal(document.getElementById('socialCardsModal')).show();

    // Render each card on canvas after modal shown
    setTimeout(() => {
      cards.forEach((card, idx) => {
        this._renderSocialCard(idx, card);
      });
    }, 300);
  },

  _renderSocialCard(idx, card) {
    const canvas = document.getElementById(`socialCard${idx}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1200, 630);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(0.5, '#16213e');
    grad.addColorStop(1, '#0f3460');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    // Gold accent bar
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(0, 0, 1200, 6);
    ctx.fillRect(0, 624, 1200, 6);

    // Trophy icon (simple)
    ctx.fillStyle = '#d4a843';
    ctx.font = '60px serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u{1F3C6}', 600, 140);

    // Award name
    ctx.fillStyle = '#d4a843';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.award.toUpperCase(), 600, 220);

    // Winner text
    ctx.fillStyle = '#ffffff';
    ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('WINNER', 600, 290);

    // Winner name
    ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(card.winner, 600, 370);

    // Divider
    ctx.strokeStyle = '#d4a843';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 410);
    ctx.lineTo(800, 410);
    ctx.stroke();

    // Event name
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(card.event, 600, 470);

    // Year
    ctx.fillStyle = '#d4a843';
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(card.year || '', 600, 540);

    // Branding
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('British Trade Awards', 600, 590);
  },

  _downloadSocialCard(idx) {
    const canvas = document.getElementById(`socialCard${idx}`);
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `social_card_${idx + 1}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  },

  _downloadAllSocialCards(count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => this._downloadSocialCard(i), i * 200);
    }
    utils.showToast(`Downloading ${count} social cards...`, 'success');
  },

  async generateWinnersCertificates() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    if (!event) return;

    let winners = [];
    try {
      const { data } = await STATE.client
        .from('award_assignments')
        .select('*, awards:award_years(award_name), organisations(company_name)')
        .eq('year', event.year)
        .eq('assignment_type', 'winner');
      winners = data || [];
    } catch (e) { console.error(e); }

    if (winners.length === 0) {
      utils.showToast('No winners found', 'warning');
      return;
    }

    // Load jsPDF if not present
    if (typeof window.jspdf === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
      script.onload = () => this._buildCertificatesPDF(event, winners);
      document.head.appendChild(script);
      return;
    }
    this._buildCertificatesPDF(event, winners);
  },

  _buildCertificatesPDF(event, winners) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

    winners.forEach((w, idx) => {
      if (idx > 0) doc.addPage();

      // Border
      doc.setDrawColor(212, 168, 67);
      doc.setLineWidth(3);
      doc.rect(10, 10, 277, 190);
      doc.setLineWidth(1);
      doc.rect(14, 14, 269, 182);

      // Header
      doc.setFontSize(14);
      doc.setTextColor(100);
      doc.text('BRITISH TRADE AWARDS', 148.5, 40, { align: 'center' });

      // Certificate title
      doc.setFontSize(36);
      doc.setTextColor(212, 168, 67);
      doc.setFont(undefined, 'bold');
      doc.text('Certificate of Excellence', 148.5, 65, { align: 'center' });

      // Awarded to
      doc.setFontSize(14);
      doc.setTextColor(80);
      doc.setFont(undefined, 'normal');
      doc.text('This certificate is proudly awarded to', 148.5, 85, { align: 'center' });

      // Winner name
      doc.setFontSize(28);
      doc.setTextColor(26, 26, 46);
      doc.setFont(undefined, 'bold');
      doc.text(w.organisations?.company_name || 'Winner', 148.5, 105, { align: 'center' });

      // Award category
      doc.setFontSize(16);
      doc.setTextColor(80);
      doc.setFont(undefined, 'normal');
      doc.text('In recognition of outstanding achievement in', 148.5, 122, { align: 'center' });

      doc.setFontSize(22);
      doc.setTextColor(212, 168, 67);
      doc.setFont(undefined, 'bold');
      doc.text(w.awards?.award_name || 'Award', 148.5, 138, { align: 'center' });

      // Event details
      doc.setFontSize(12);
      doc.setTextColor(120);
      doc.setFont(undefined, 'normal');
      const dateStr = event.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      doc.text(`${event.event_name} | ${dateStr}`, 148.5, 160, { align: 'center' });
      if (event.venue) doc.text(event.venue, 148.5, 168, { align: 'center' });

      // Signature line
      doc.setDrawColor(180);
      doc.setLineWidth(0.5);
      doc.line(95, 185, 202, 185);
      doc.setFontSize(10);
      doc.text('Authorised Signature', 148.5, 192, { align: 'center' });
    });

    doc.save(`${event.event_name.replace(/[^a-z0-9]/gi, '_')}_certificates.pdf`);
    utils.showToast(`Generated ${winners.length} certificates`, 'success');
  },

  async generateWinnerPackage() {
    // Scroll to winner highlights section and flash it
    const el = document.getElementById('winnerHighlightsContent');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.closest('.card').classList.add('border-warning');
      el.closest('.card').style.boxShadow = '0 0 10px rgba(255,193,7,0.5)';
      setTimeout(() => {
        el.closest('.card').classList.remove('border-warning');
        el.closest('.card').style.boxShadow = '';
      }, 2000);
    }
  },

  // ========================================
  // POST-EVENT: SPONSOR ROI REPORT
  // ========================================

  async _renderSponsorReport(eventId) {
    const event = STATE.allEvents.find(e => e.id === eventId);
    const attendees = await this.getAttendees(eventId);
    const attending = attendees.filter(a => a.status === 'attending');
    const sponsors = attendees.filter(a => a.guestType === 'sponsor');
    const budget = this.getBudget(eventId);
    const vendors = this.getVendors(eventId);
    const data = this._getPostEventData(eventId);

    const totalRevenue = (event?.ticket_price || 0) * attending.length;
    const totalSpent = budget.items ? budget.items.reduce((s, i) => s + (parseFloat(i.actual) || 0), 0) : 0;
    const sponsorVendors = vendors.filter(v => v.category === 'Sponsorship' || (v.notes || '').toLowerCase().includes('sponsor'));

    return `
      <div class="row g-3 mb-3">
        <div class="col-md-3"><div class="card text-center bg-light"><div class="card-body py-2">
          <h4 class="mb-0">${attending.length}</h4><small class="text-muted">Total Attendees</small>
        </div></div></div>
        <div class="col-md-3"><div class="card text-center bg-light"><div class="card-body py-2">
          <h4 class="mb-0 text-success">\u00A3${totalRevenue.toFixed(0)}</h4><small class="text-muted">Ticket Revenue</small>
        </div></div></div>
        <div class="col-md-3"><div class="card text-center bg-light"><div class="card-body py-2">
          <h4 class="mb-0 text-danger">\u00A3${totalSpent.toFixed(0)}</h4><small class="text-muted">Total Costs</small>
        </div></div></div>
        <div class="col-md-3"><div class="card text-center bg-light"><div class="card-body py-2">
          <h4 class="mb-0 ${totalRevenue - totalSpent >= 0 ? 'text-success' : 'text-danger'}">\u00A3${(totalRevenue - totalSpent).toFixed(0)}</h4><small class="text-muted">Net P&L</small>
        </div></div></div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <div class="card"><div class="card-body py-2">
            <h6 class="mb-2"><i class="bi bi-people me-2"></i>Audience Demographics</h6>
            <div class="d-flex gap-3 flex-wrap">
              <span class="badge bg-warning text-dark">VIPs: ${attendees.filter(a => a.guestType === 'vip').length}</span>
              <span class="badge bg-success">Sponsors: ${sponsors.length}</span>
              <span class="badge bg-primary">Speakers: ${attendees.filter(a => a.guestType === 'speaker').length}</span>
              <span class="badge bg-info">Media: ${attendees.filter(a => a.guestType === 'media').length}</span>
              <span class="badge bg-secondary">Staff: ${attendees.filter(a => a.guestType === 'staff').length}</span>
            </div>
          </div></div>
        </div>
        <div class="col-md-6">
          <div class="card"><div class="card-body py-2">
            <h6 class="mb-2"><i class="bi bi-clipboard-data me-2"></i>Sponsor Engagement</h6>
            <div class="row g-2">
              <div class="col-4">
                <label class="form-label small mb-0">Social Reach</label>
                <input type="text" class="form-control form-control-sm" id="sponsorSocialReach" value="${utils.escapeHtml(data.socialReach || '')}" placeholder="e.g., 50K" onchange="eventsModule.savePostEventData()">
              </div>
              <div class="col-4">
                <label class="form-label small mb-0">Press Mentions</label>
                <input type="number" class="form-control form-control-sm" id="sponsorPressMentions" value="${data.pressMentions || ''}" min="0" onchange="eventsModule.savePostEventData()">
              </div>
              <div class="col-4">
                <label class="form-label small mb-0">Media Value</label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text">\u00A3</span>
                  <input type="number" class="form-control" id="sponsorMediaValue" value="${data.mediaValue || ''}" min="0" onchange="eventsModule.savePostEventData()">
                </div>
              </div>
            </div>
          </div></div>
        </div>
      </div>

      <div class="text-end">
        <button class="btn btn-sm btn-outline-primary" onclick="eventsModule.exportSponsorReport()"><i class="bi bi-download me-1"></i>Export Sponsor Report CSV</button>
      </div>`;
  },

  generateSponsorReport() {
    // Scroll to sponsor ROI section and flash it
    const el = document.getElementById('sponsorROIContent');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.closest('.card').classList.add('border-info');
      el.closest('.card').style.boxShadow = '0 0 10px rgba(13,202,240,0.5)';
      setTimeout(() => {
        el.closest('.card').classList.remove('border-info');
        el.closest('.card').style.boxShadow = '';
      }, 2000);
    }
  },

  async exportSponsorReport() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const attendees = await this.getAttendees(eventId);
    const budget = this.getBudget(eventId);
    const data = this._getPostEventData(eventId);

    const attending = attendees.filter(a => a.status === 'attending');
    const totalRevenue = (event?.ticket_price || 0) * attending.length;
    const totalSpent = budget.items ? budget.items.reduce((s, i) => s + (parseFloat(i.actual) || 0), 0) : 0;

    const rows = [{
      'Event': event?.event_name || '',
      'Date': event?.event_date || '',
      'Venue': event?.venue || '',
      'Total Attendees': attending.length,
      'VIPs': attendees.filter(a => a.guestType === 'vip').length,
      'Sponsors': attendees.filter(a => a.guestType === 'sponsor').length,
      'Media': attendees.filter(a => a.guestType === 'media').length,
      'Ticket Revenue': totalRevenue,
      'Total Costs': totalSpent,
      'Net P&L': totalRevenue - totalSpent,
      'Social Reach': data.socialReach || '',
      'Press Mentions': data.pressMentions || '',
      'Estimated Media Value': data.mediaValue || '',
      'Survey Response Rate': data.surveyResponses ? `${Math.round(data.surveyResponses / attending.length * 100)}%` : '',
      'Average Rating': data.avgRating || ''
    }];

    utils.exportToCSV(rows, `${event ? event.event_name.replace(/[^a-z0-9]/gi, '_') : 'event'}_sponsor_roi.csv`);
    utils.showToast('Sponsor report exported', 'success');
  },

  // ========================================
  // POST-EVENT: EVENT DEBRIEF
  // ========================================

  _renderDebrief(eventId) {
    const data = this._getPostEventData(eventId);
    const debrief = data.debrief || {};

    return `
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label small fw-bold text-success"><i class="bi bi-hand-thumbs-up me-1"></i>What Went Well</label>
          <textarea class="form-control form-control-sm" id="debriefWentWell" rows="4" placeholder="e.g., Registration process was smooth, entertainment was excellent, catering received great feedback...">${utils.escapeHtml(debrief.wentWell || '')}</textarea>
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-bold text-danger"><i class="bi bi-hand-thumbs-down me-1"></i>What Could Be Improved</label>
          <textarea class="form-control form-control-sm" id="debriefImprove" rows="4" placeholder="e.g., Audio issues during speeches, check-in queue too long, parking signage unclear...">${utils.escapeHtml(debrief.improve || '')}</textarea>
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-bold text-primary"><i class="bi bi-lightbulb me-1"></i>Ideas for Next Year</label>
          <textarea class="form-control form-control-sm" id="debriefIdeas" rows="4" placeholder="e.g., Add live streaming, introduce networking app, try a new venue, longer drinks reception...">${utils.escapeHtml(debrief.ideas || '')}</textarea>
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-bold text-warning"><i class="bi bi-exclamation-triangle me-1"></i>Key Decisions / Action Items</label>
          <textarea class="form-control form-control-sm" id="debriefActions" rows="4" placeholder="e.g., Book same venue for next year by March, hire additional AV crew, increase catering budget by 15%...">${utils.escapeHtml(debrief.actions || '')}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label small fw-bold"><i class="bi bi-chat-dots me-1"></i>Additional Notes</label>
          <textarea class="form-control form-control-sm" id="debriefNotes" rows="3" placeholder="Any other observations, feedback from team members, or notes for the record...">${utils.escapeHtml(debrief.notes || '')}</textarea>
        </div>
        <div class="col-12 text-end">
          <button class="btn btn-sm btn-outline-secondary me-2" onclick="eventsModule.exportDebrief()"><i class="bi bi-download me-1"></i>Export Debrief</button>
          <button class="btn btn-sm btn-primary" onclick="eventsModule.saveDebrief()"><i class="bi bi-save me-1"></i>Save Debrief</button>
        </div>
      </div>`;
  },

  saveDebrief() {
    const eventId = document.getElementById('attendeesEventId').value;
    const data = this._getPostEventData(eventId);
    data.debrief = {
      wentWell: document.getElementById('debriefWentWell')?.value || '',
      improve: document.getElementById('debriefImprove')?.value || '',
      ideas: document.getElementById('debriefIdeas')?.value || '',
      actions: document.getElementById('debriefActions')?.value || '',
      notes: document.getElementById('debriefNotes')?.value || ''
    };

    // Also save sponsor engagement fields if they exist
    data.socialReach = document.getElementById('sponsorSocialReach')?.value || data.socialReach || '';
    data.pressMentions = parseInt(document.getElementById('sponsorPressMentions')?.value) || data.pressMentions || 0;
    data.mediaValue = parseFloat(document.getElementById('sponsorMediaValue')?.value) || data.mediaValue || 0;
    data.avgRating = parseFloat(document.getElementById('surveyAvgRating')?.value) || data.avgRating || '';

    this._savePostEventDataStore(eventId, data);
    utils.showToast('Debrief saved', 'success');
  },

  exportDebrief() {
    const eventId = document.getElementById('attendeesEventId').value;
    const event = STATE.allEvents.find(e => e.id === eventId);
    const data = this._getPostEventData(eventId);
    const debrief = data.debrief || {};

    let text = `EVENT DEBRIEF\n${'='.repeat(50)}\n\n`;
    text += `Event: ${event?.event_name || ''}\n`;
    text += `Date: ${event?.event_date || ''}\n`;
    text += `Venue: ${event?.venue || ''}\n\n`;
    text += `WHAT WENT WELL\n${'-'.repeat(30)}\n${debrief.wentWell || 'N/A'}\n\n`;
    text += `WHAT COULD BE IMPROVED\n${'-'.repeat(30)}\n${debrief.improve || 'N/A'}\n\n`;
    text += `IDEAS FOR NEXT YEAR\n${'-'.repeat(30)}\n${debrief.ideas || 'N/A'}\n\n`;
    text += `KEY DECISIONS / ACTION ITEMS\n${'-'.repeat(30)}\n${debrief.actions || 'N/A'}\n\n`;
    text += `ADDITIONAL NOTES\n${'-'.repeat(30)}\n${debrief.notes || 'N/A'}\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${event ? event.event_name.replace(/[^a-z0-9]/gi, '_') : 'event'}_debrief.txt`;
    a.click();
    utils.showToast('Debrief exported', 'success');
  },

  // ========================================
  // POST-EVENT: FULL EXPORT PACK
  // ========================================

  async exportPostEventPack() {
    const eventId = document.getElementById('attendeesEventId').value;
    utils.showToast('Generating exports... check your downloads', 'info');

    // Export attendance report
    this.generateAttendanceReport();
    // Export budget
    setTimeout(() => this.exportBudget(), 300);
    // Export vendors
    setTimeout(() => this.exportVendors(), 600);
    // Export debrief
    setTimeout(() => this.exportDebrief(), 900);
    // Export sponsor report
    setTimeout(() => this.exportSponsorReport(), 1200);
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
                  <button class="btn btn-sm btn-success" onclick="eventsModule.openAddWinnersChecklist()" ${this.isPublished ? 'disabled' : ''}>
                    <i class="bi bi-trophy me-1"></i>Add Winners
                  </button>
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
                             oninput="clearTimeout(eventsModule._roSearchTimer); eventsModule._roSearchTimer = setTimeout(() => eventsModule.searchRunningOrder(this.value), 300)">
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
                  <div class="d-flex gap-2 justify-content-center flex-wrap">
                    <button class="btn btn-success" onclick="eventsModule.openAddWinnersChecklist()">
                      <i class="bi bi-trophy me-2"></i>Add Winners
                    </button>
                    <button class="btn btn-primary" onclick="eventsModule.syncFromRSVPs()">
                      <i class="bi bi-arrow-repeat me-2"></i>Sync from RSVPs
                    </button>
                    <button class="btn btn-outline-secondary" onclick="eventsModule.addManualEntry()">
                      <i class="bi bi-plus-circle me-2"></i>Add Manual Entry
                    </button>
                  </div>
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
      // Try with FK joins first, fall back to simple query if relationships missing
      let items, itemsError;
      ({ data: items, error: itemsError } = await STATE.client
        .from('running_order')
        .select(`
          *,
          organisations(company_name, logo_url),
          awards:award_years(award_name),
          event_guests(guest_name, guest_email)
        `)
        .eq('event_id', this.currentEventIdRunningOrder)
        .order('display_order', { ascending: true }));

      if (itemsError) {
        // Table may not exist
        if (itemsError.code === '42P01' || itemsError.message?.includes('does not exist')) {
          this.runningOrderItems = [];
          this.isPublished = false;
          this._roCeremonyStartTime = null;
          this._roAutoSchedule = false;
          return;
        }
        // FK relationship missing in schema cache - retry without joins
        if (itemsError.message?.includes('relationship') || itemsError.message?.includes('schema cache')) {
          console.warn('Running order FK relationships not found, loading without joins');
          const fallback = await STATE.client
            .from('running_order')
            .select('*')
            .eq('event_id', this.currentEventIdRunningOrder)
            .order('display_order', { ascending: true });
          if (fallback.error) throw fallback.error;
          items = fallback.data || [];
          itemsError = null;
        } else {
          throw itemsError;
        }
      }
      this.runningOrderItems = items || [];

      // Load settings (table may not exist)
      try {
        const { data: settings, error: settingsError } = await STATE.client
          .from('running_order_settings')
          .select('*')
          .eq('event_id', this.currentEventIdRunningOrder)
          .single();

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.warn('Error loading RO settings:', settingsError);
        }
        this.isPublished = settings?.is_published || false;
        this._roCeremonyStartTime = settings?.ceremony_start_time || null;
        this._roAutoSchedule = settings?.auto_schedule || false;
      } catch (settingsErr) {
        console.warn('Running order settings not available:', settingsErr);
        this.isPublished = false;
        this._roCeremonyStartTime = null;
        this._roAutoSchedule = false;
      }
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
      const awardName = item.award_name || item.item_name || (item.awards ? item.awards.award_name : 'Award TBC');
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

    if (!await utils.confirmDialog({ title: 'Restore Version', message: `Restore "${version.version_name}"?<br><br>This will replace the current running order with this saved version. Consider saving the current version first.`, confirmText: 'Restore', danger: false })) {
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
    if (!await utils.confirmDialog({ title: 'Delete Version', message: 'Delete this saved version?' })) return;
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
    const eventId = this.currentEventIdRunningOrder;
    if (!eventId) { utils.showToast('No event selected', 'warning'); return; }

    try {
      utils.showLoading();

      // 1. Get confirmed RSVPs for this event
      const { data: guests, error: gErr } = await STATE.client
        .from('event_guests')
        .select('id, organisation_id, guest_name, guest_email, guest_type')
        .eq('event_id', eventId)
        .eq('rsvp_status', 'confirmed');
      if (gErr) throw gErr;

      if (!guests || guests.length === 0) {
        utils.showToast('No confirmed RSVPs found for this event', 'warning');
        return;
      }

      // 2. Get winner assignments for these organisations
      const orgIds = [...new Set(guests.map(g => g.organisation_id).filter(Boolean))];
      let assignMap = {};
      if (orgIds.length > 0) {
        const { data: assigns } = await STATE.client
          .from('award_assignments')
          .select('award_id, organisation_id')
          .in('organisation_id', orgIds)
          .eq('status', 'winner');
        (assigns || []).forEach(a => {
          if (!assignMap[a.organisation_id]) assignMap[a.organisation_id] = [];
          assignMap[a.organisation_id].push(a.award_id);
        });
      }

      // 3. Get award names
      const allAwardIds = [...new Set(Object.values(assignMap).flat())];
      let awardMap = {};
      if (allAwardIds.length > 0) {
        const { data: awards } = await STATE.client
          .from('awards')
          .select('id, award_name')
          .in('id', allAwardIds);
        (awards || []).forEach(a => { awardMap[a.id] = a.award_name; });
      }

      // 4. Get org names
      let orgMap = {};
      if (orgIds.length > 0) {
        const { data: orgs } = await STATE.client
          .from('organisations')
          .select('id, company_name')
          .in('id', orgIds);
        (orgs || []).forEach(o => { orgMap[o.id] = o.company_name; });
      }

      // 5. Build running order entries — skip those already present
      const existingKeys = new Set(this.runningOrderItems.map(i =>
        `${i.guest_id || ''}|${i.award_id || ''}`
      ));
      const existingCount = this.runningOrderItems.length;
      const section = existingCount > 0
        ? (this.runningOrderItems[existingCount - 1].section || 1)
        : 1;

      let added = 0;
      let order = existingCount;

      for (const guest of guests) {
        const awardIds = assignMap[guest.organisation_id] || [null];
        for (const awardId of awardIds) {
          const key = `${guest.id}|${awardId || ''}`;
          if (existingKeys.has(key)) continue;

          order++;
          const awardNum = `${section}-${String(order).padStart(2, '0')}`;
          const entry = {
            event_id: eventId,
            guest_id: guest.id,
            organisation_id: guest.organisation_id || null,
            award_id: awardId || null,
            award_name: awardId ? (awardMap[awardId] || '') : '',
            item_name: awardId ? (awardMap[awardId] || '') : guest.guest_name,
            display_name: orgMap[guest.organisation_id] || guest.guest_name || '',
            recipient_collecting: guest.guest_name || '',
            award_number: awardNum,
            display_order: order,
            section: section,
            duration_minutes: 3,
            status: 'pending'
          };

          const result = await STATE.client.from('running_order').insert([entry]);
          if (result.error) {
            // Schema cache fallback — try minimal columns
            const minimal = {
              event_id: eventId,
              item_name: entry.item_name || entry.display_name,
              display_order: order,
              duration_minutes: 3
            };
            const retry = await STATE.client.from('running_order').insert([minimal]);
            if (!retry.error) added++;
            else console.warn('Failed to insert RSVP entry:', retry.error.message);
          } else {
            added++;
          }
        }
      }

      utils.showToast(`Added ${added} new item${added !== 1 ? 's' : ''} from RSVPs`, 'success');
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
      const awardName = item.award_name || item.item_name || (item.awards ? item.awards.award_name : 'N/A');
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
    if (!await utils.confirmDialog({ title: 'Remove Item', message: 'Remove this item from the running order?', confirmText: 'Remove' })) return;
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

  // ========================================
  // ADD WINNERS CHECKLIST
  // ========================================

  /**
   * Open the Add Winners checklist modal.
   * Queries award_assignments (status='winner') joined with awards + organisations
   * for the current event, shows a checklist, and bulk-inserts selected winners.
   */
  async openAddWinnersChecklist() {
    const eventId = this.currentEventIdRunningOrder;
    if (!eventId) { utils.showToast('No event selected', 'warning'); return; }

    try {
      utils.showLoading();

      // Look up the event year to match awards (awards link to events by year)
      const event = STATE.allEvents.find(e => e.id === eventId);
      if (!event || !event.year) {
        utils.showToast('Could not determine event year. Set the year on this event first.', 'warning');
        return;
      }

      // 1. Load all awards for this event's year with their winner assignments
      let awardsQuery = STATE.client
        .from('award_years')
        .select('id, award_name, award_category, sector')
        .eq('year', event.year)
        .order('sector', { ascending: true });

      const { data: awards, error: awardsErr } = await awardsQuery;
      if (awardsErr) throw awardsErr;

      if (!awards || awards.length === 0) {
        utils.showToast(`No awards found for ${event.year}. Add awards first.`, 'warning');
        return;
      }

      // 2. Load confirmed winners from award_assignments
      const awardIds = awards.map(a => a.id);
      const { data: assignments, error: assignErr } = await STATE.client
        .from('award_assignments')
        .select('award_id, organisation_id, status, winner_position')
        .in('award_id', awardIds)
        .eq('status', 'winner');
      if (assignErr) throw assignErr;

      // 3. Load organisation names for winners
      const orgIds = [...new Set((assignments || []).map(a => a.organisation_id).filter(Boolean))];
      let orgsMap = {};
      if (orgIds.length > 0) {
        const { data: orgs } = await STATE.client
          .from('organisations')
          .select('id, company_name')
          .in('id', orgIds);
        (orgs || []).forEach(o => { orgsMap[o.id] = o.company_name; });
      }

      // 4. Build the merged list: award + winner info
      const existingAwardIds = new Set(this.runningOrderItems.map(i => i.award_id).filter(Boolean));
      const assignmentsByAward = {};
      (assignments || []).forEach(a => {
        if (!assignmentsByAward[a.award_id]) assignmentsByAward[a.award_id] = [];
        assignmentsByAward[a.award_id].push(a);
      });

      const rows = awards.map(award => {
        const winners = assignmentsByAward[award.id] || [];
        const topWinner = winners[0];
        const orgName = topWinner ? (orgsMap[topWinner.organisation_id] || 'Unknown') : null;
        const alreadyInRO = existingAwardIds.has(award.id);
        return {
          awardId: award.id,
          awardName: award.award_name || 'Unnamed Award',
          sector: award.sector || '',
          category: award.award_category || '',
          hasWinner: winners.length > 0,
          winnerName: orgName,
          winnerOrgId: topWinner?.organisation_id || null,
          alreadyInRO
        };
      });

      // Sort: winners first, then by sector/category
      rows.sort((a, b) => {
        if (a.hasWinner !== b.hasWinner) return a.hasWinner ? -1 : 1;
        if (a.alreadyInRO !== b.alreadyInRO) return a.alreadyInRO ? 1 : -1;
        return (a.sector + a.category).localeCompare(b.sector + b.category);
      });

      const winnersCount = rows.filter(r => r.hasWinner && !r.alreadyInRO).length;
      const alreadyCount = rows.filter(r => r.alreadyInRO).length;

      // 5. Build modal HTML
      const modalHtml = `
        <div class="modal fade" id="addWinnersChecklistModal" tabindex="-1">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header bg-success text-white">
                <h5 class="modal-title"><i class="bi bi-trophy me-2"></i>Add Winners to Running Order</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body p-0">
                <div class="px-3 pt-3 pb-2 bg-light border-bottom">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <span class="badge bg-success me-1">${winnersCount}</span> confirmed winners available
                      ${alreadyCount > 0 ? `<span class="badge bg-secondary ms-1">${alreadyCount}</span> already in running order` : ''}
                    </div>
                    <div class="d-flex gap-2">
                      <button class="btn btn-sm btn-outline-success" onclick="eventsModule._winnersChecklistSelectAll(true)">Select All Winners</button>
                      <button class="btn btn-sm btn-outline-secondary" onclick="eventsModule._winnersChecklistSelectAll(false)">Deselect All</button>
                    </div>
                  </div>
                  <div class="input-group input-group-sm">
                    <span class="input-group-text"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control" id="winnersChecklistSearch" placeholder="Filter awards..." oninput="eventsModule._filterWinnersChecklist(this.value)">
                  </div>
                </div>
                <div id="winnersChecklistBody" style="max-height:450px; overflow-y:auto;">
                  ${this._renderWinnersChecklistRows(rows)}
                </div>
              </div>
              <div class="modal-footer">
                <span class="text-muted small me-auto" id="winnersSelectedCount">0 selected</span>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-success" id="addWinnersSubmitBtn" onclick="eventsModule._submitWinnersChecklist()" disabled>
                  <i class="bi bi-plus-circle me-2"></i>Add Selected to Running Order
                </button>
              </div>
            </div>
          </div>
        </div>`;

      // Store data for submission
      this._winnersChecklistData = rows;

      const existingModal = document.getElementById('addWinnersChecklistModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('addWinnersChecklistModal'));
      modal.show();
      document.getElementById('addWinnersChecklistModal').addEventListener('hidden.bs.modal', function() { this.remove(); });

    } catch (err) {
      console.error('Error loading winners checklist:', err);
      utils.showToast('Failed to load winners: ' + err.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  _renderWinnersChecklistRows(rows) {
    if (!rows || rows.length === 0) {
      return '<div class="text-center py-4 text-muted"><i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>No awards found for this event</div>';
    }

    let currentSector = '';
    let html = '';

    rows.forEach((row, idx) => {
      // Sector group header
      if (row.sector !== currentSector) {
        currentSector = row.sector;
        html += `<div class="px-3 py-1 bg-light border-bottom fw-semibold small text-uppercase text-muted" style="letter-spacing:0.5px;">${utils.escapeHtml(currentSector || 'No Sector')}</div>`;
      }

      const disabled = row.alreadyInRO;
      const checked = row.hasWinner && !row.alreadyInRO ? 'checked' : '';

      html += `
        <div class="winners-checklist-row px-3 py-2 border-bottom d-flex align-items-center gap-2 ${disabled ? 'opacity-50' : ''}" data-idx="${idx}" data-award-name="${utils.escapeHtml(row.awardName.toLowerCase())}" data-sector="${utils.escapeHtml(row.sector.toLowerCase())}">
          <input type="checkbox" class="form-check-input winners-cb" data-idx="${idx}"
                 ${checked} ${disabled ? 'disabled' : ''}
                 onchange="eventsModule._updateWinnersSelectedCount()">
          <div class="flex-grow-1">
            <div class="fw-semibold" style="font-size:0.9rem;">${utils.escapeHtml(row.awardName)}</div>
            <div class="small text-muted">${utils.escapeHtml(row.category)}</div>
          </div>
          <div style="width:200px;" class="text-end">
            ${row.hasWinner
              ? `<span class="badge bg-success"><i class="bi bi-trophy-fill me-1"></i>${utils.escapeHtml(row.winnerName)}</span>`
              : '<span class="badge bg-secondary">No winner confirmed</span>'}
          </div>
          <div style="width:100px;" class="text-end">
            ${row.alreadyInRO ? '<span class="badge bg-info">In RO</span>' : ''}
          </div>
        </div>`;
    });
    return html;
  },

  _winnersChecklistSelectAll(selectAll) {
    document.querySelectorAll('.winners-cb:not(:disabled)').forEach(cb => { cb.checked = selectAll; });
    this._updateWinnersSelectedCount();
  },

  _filterWinnersChecklist(term) {
    const lower = term.toLowerCase();
    document.querySelectorAll('.winners-checklist-row').forEach(row => {
      const name = row.dataset.awardName || '';
      const sector = row.dataset.sector || '';
      row.style.display = (!term || name.includes(lower) || sector.includes(lower)) ? '' : 'none';
    });
  },

  _updateWinnersSelectedCount() {
    const checked = document.querySelectorAll('.winners-cb:checked:not(:disabled)').length;
    const countEl = document.getElementById('winnersSelectedCount');
    const btn = document.getElementById('addWinnersSubmitBtn');
    if (countEl) countEl.textContent = checked + ' selected';
    if (btn) btn.disabled = checked === 0;
  },

  async _submitWinnersChecklist() {
    const rows = this._winnersChecklistData || [];
    const selectedIdxs = [];
    document.querySelectorAll('.winners-cb:checked:not(:disabled)').forEach(cb => {
      selectedIdxs.push(parseInt(cb.dataset.idx));
    });

    if (selectedIdxs.length === 0) { utils.showToast('No awards selected', 'warning'); return; }

    try {
      utils.showLoading();
      const eventId = this.currentEventIdRunningOrder;
      const existingCount = this.runningOrderItems.length;
      const section = existingCount > 0
        ? (this.runningOrderItems[existingCount - 1].section || 1)
        : 1;

      let added = 0;
      for (let i = 0; i < selectedIdxs.length; i++) {
        const row = rows[selectedIdxs[i]];
        const order = existingCount + i + 1;
        const awardNum = `${section}-${String(order).padStart(2, '0')}`;

        const entryData = {
          event_id: eventId,
          award_id: row.awardId,
          organisation_id: row.winnerOrgId || null,
          item_name: row.awardName,
          award_name: row.awardName,
          display_name: row.winnerName || 'TBC',
          award_number: awardNum,
          display_order: order,
          section: section,
          duration_minutes: 3,
          status: 'pending'
        };

        let result = await STATE.client.from('running_order').insert([entryData]);
        // Schema cache fallback
        if (result.error && result.error.message && result.error.message.includes('schema cache')) {
          const baseEntry = {
            event_id: eventId,
            item_name: row.awardName,
            display_order: order,
            duration_minutes: 3
          };
          result = await STATE.client.from('running_order').insert([baseEntry]);
        }
        if (result.error) {
          console.warn('Failed to insert award:', row.awardName, result.error.message);
        } else {
          added++;
        }
      }

      utils.showToast(`Added ${added} award${added !== 1 ? 's' : ''} to running order`, 'success');
      bootstrap.Modal.getInstance(document.getElementById('addWinnersChecklistModal'))?.hide();
      await this.loadRunningOrder();
      this.renderRunningOrderItems();

    } catch (err) {
      console.error('Error adding winners:', err);
      utils.showToast('Failed to add winners: ' + err.message, 'error');
    } finally {
      utils.hideLoading();
    }
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
        <div class="modal-dialog modal-lg">
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

                <!-- Cascading Award Selection: Sector → Category → Award -->
                <div class="card border-primary mb-3">
                  <div class="card-header bg-light py-2">
                    <small class="fw-semibold text-primary"><i class="bi bi-funnel me-1"></i>Select Award</small>
                  </div>
                  <div class="card-body py-2">
                    <div class="row g-2">
                      <div class="col-md-4">
                        <label class="form-label small mb-1">Sector</label>
                        <select class="form-select form-select-sm" id="manualSectorFilter" onchange="eventsModule._onManualSectorChange()">
                          <option value="">-- Select Sector --</option>
                        </select>
                      </div>
                      <div class="col-md-4">
                        <label class="form-label small mb-1">Category</label>
                        <select class="form-select form-select-sm" id="manualCategoryFilter" onchange="eventsModule._onManualCategoryChange()" disabled>
                          <option value="">-- Select Sector first --</option>
                        </select>
                      </div>
                      <div class="col-md-4">
                        <label class="form-label small mb-1">Award</label>
                        <select class="form-select form-select-sm" id="manualAwardSelect" onchange="eventsModule._onManualAwardSelect()" disabled>
                          <option value="">-- Select Category first --</option>
                        </select>
                      </div>
                    </div>
                    <div id="manualAwardInfo" class="mt-2" style="display:none;">
                      <div class="alert alert-success py-1 px-2 mb-0 small">
                        <i class="bi bi-check-circle me-1"></i>
                        <span id="manualAwardInfoText"></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Award Name <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="manualAwardName" required placeholder="Auto-filled from selection above, or type manually">
                  <input type="hidden" id="manualAwardId" value="">
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

    // Load awards for this event and populate the sector dropdown
    this._loadAwardsForManualEntry();
  },

  /** Cache of awards for the current event (used by cascading dropdown) */
  _manualEntryAwards: [],

  async _loadAwardsForManualEntry() {
    try {
      const { data, error } = await STATE.client
        .from('award_years')
        .select('id, award_name, award_category, sector, event_id, winner_confirmed, prev_year_winner')
        .eq('event_id', this.currentEventIdRunningOrder)
        .order('sector', { ascending: true });

      if (error) throw error;
      this._manualEntryAwards = data || [];

      // Populate sector dropdown with distinct sectors
      const sectors = [...new Set(this._manualEntryAwards.map(a => a.sector).filter(Boolean))].sort();
      const sectorSelect = document.getElementById('manualSectorFilter');
      if (sectorSelect) {
        sectorSelect.innerHTML = '<option value="">-- Select Sector (' + sectors.length + ') --</option>' +
          sectors.map(s => `<option value="${utils.escapeHtml(s)}">${utils.escapeHtml(s)}</option>`).join('');
      }
    } catch (err) {
      console.warn('Could not load awards for dropdown:', err);
      // Dropdowns stay empty — user can still type manually
    }
  },

  _onManualSectorChange() {
    const sector = document.getElementById('manualSectorFilter').value;
    const catSelect = document.getElementById('manualCategoryFilter');
    const awardSelect = document.getElementById('manualAwardSelect');
    const infoDiv = document.getElementById('manualAwardInfo');

    // Reset downstream
    awardSelect.innerHTML = '<option value="">-- Select Category first --</option>';
    awardSelect.disabled = true;
    if (infoDiv) infoDiv.style.display = 'none';
    document.getElementById('manualAwardId').value = '';

    if (!sector) {
      catSelect.innerHTML = '<option value="">-- Select Sector first --</option>';
      catSelect.disabled = true;
      return;
    }

    const filtered = this._manualEntryAwards.filter(a => a.sector === sector);
    const categories = [...new Set(filtered.map(a => a.award_category).filter(Boolean))].sort();

    catSelect.innerHTML = '<option value="">-- Select Category (' + categories.length + ') --</option>' +
      categories.map(c => `<option value="${utils.escapeHtml(c)}">${utils.escapeHtml(c)}</option>`).join('');
    catSelect.disabled = false;
  },

  _onManualCategoryChange() {
    const sector = document.getElementById('manualSectorFilter').value;
    const category = document.getElementById('manualCategoryFilter').value;
    const awardSelect = document.getElementById('manualAwardSelect');
    const infoDiv = document.getElementById('manualAwardInfo');

    if (infoDiv) infoDiv.style.display = 'none';
    document.getElementById('manualAwardId').value = '';

    if (!category) {
      awardSelect.innerHTML = '<option value="">-- Select Category first --</option>';
      awardSelect.disabled = true;
      return;
    }

    const filtered = this._manualEntryAwards.filter(a => a.sector === sector && a.award_category === category);

    // Check which awards are already in the running order
    const existingAwardIds = new Set(this.runningOrderItems.map(i => i.award_id).filter(Boolean));

    awardSelect.innerHTML = '<option value="">-- Select Award (' + filtered.length + ') --</option>' +
      filtered.map(a => {
        const alreadyAdded = existingAwardIds.has(a.id);
        const label = utils.escapeHtml(a.award_name || 'Unnamed Award') +
          (alreadyAdded ? ' (already in running order)' : '') +
          (a.winner_confirmed ? ' \u2713' : '');
        return `<option value="${a.id}" ${alreadyAdded ? 'class="text-muted"' : ''}>${label}</option>`;
      }).join('');
    awardSelect.disabled = false;
  },

  _onManualAwardSelect() {
    const awardId = document.getElementById('manualAwardSelect').value;
    const infoDiv = document.getElementById('manualAwardInfo');
    const infoText = document.getElementById('manualAwardInfoText');

    if (!awardId) {
      if (infoDiv) infoDiv.style.display = 'none';
      document.getElementById('manualAwardId').value = '';
      return;
    }

    const award = this._manualEntryAwards.find(a => a.id === awardId);
    if (!award) return;

    // Auto-fill the award name field
    document.getElementById('manualAwardName').value = award.award_name || '';
    document.getElementById('manualAwardId').value = award.id;

    // Show info
    if (infoDiv && infoText) {
      const parts = [award.award_name];
      if (award.prev_year_winner) parts.push('Prev winner: ' + award.prev_year_winner);
      infoText.textContent = parts.join(' | ');
      infoDiv.style.display = 'block';
    }
  },

  async saveManualEntry() {
    const form = document.getElementById('addManualEntryForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const section = this.runningOrderItems.length > 0
      ? (this.runningOrderItems[this.runningOrderItems.length - 1].section || 1)
      : 1;
    const awardName = document.getElementById('manualAwardName').value.trim();
    const awardId = document.getElementById('manualAwardId').value || null;

    const entryData = {
      event_id: this.currentEventIdRunningOrder,
      award_number: document.getElementById('manualAwardNumber').value.trim() || '1',
      display_order: this.runningOrderItems.length + 1,
      section: section,
      item_name: awardName,
      award_name: awardName,
      display_name: document.getElementById('manualDisplayName').value.trim(),
      recipient_collecting: document.getElementById('manualRecipient').value.trim() || null,
      scheduled_time: document.getElementById('manualScheduledTime').value || null,
      duration_minutes: parseInt(document.getElementById('manualDuration').value) || 3,
      sponsor: document.getElementById('manualSponsor').value.trim() || null,
      notes: document.getElementById('manualNotes').value.trim() || null,
      status: 'pending'
    };
    if (awardId) entryData.award_id = awardId;

    try {
      let result = await STATE.client.from('running_order').insert([entryData]);
      // If schema cache doesn't recognise extended columns, retry with base columns only
      if (result.error && result.error.message && result.error.message.includes('schema cache')) {
        console.warn('Schema cache miss on running_order, retrying with base columns');
        const baseEntry = {
          event_id: entryData.event_id,
          item_name: awardName,
          display_order: entryData.display_order,
          duration_minutes: entryData.duration_minutes
        };
        result = await STATE.client.from('running_order').insert([baseEntry]);
      }
      if (result.error) throw result.error;
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
    const awardName = document.getElementById('editROAwardName').value || null;
    const updateData = {
      award_number: document.getElementById('editROAwardNumber').value || null,
      item_name: awardName,
      award_name: awardName,
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
      let result = await STATE.client.from('running_order').update(updateData).eq('id', itemId);
      // Fallback if schema cache doesn't know extended columns
      if (result.error && result.error.message && result.error.message.includes('schema cache')) {
        console.warn('Schema cache miss on running_order update, retrying with base columns');
        const baseUpdate = {
          item_name: awardName,
          duration_minutes: updateData.duration_minutes
        };
        result = await STATE.client.from('running_order').update(baseUpdate).eq('id', itemId);
      }
      if (result.error) throw result.error;
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
  roomFixtures: [], // Stage, photowall, AV booth etc.
  _fixtureDrag: null, // {fixtureId, startX, startY, origLeft, origTop, moved}
  _fixtureResize: null, // {fixtureId, startX, startY, origW, origH, handle}
  _selectedFixtureId: null,
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
    const hasTables = this.tables.length > 0;

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
                <span class="badge bg-info" id="tpSeatedBadge">${totalSeated} seated</span>
                <span class="badge bg-warning text-dark" id="tpUnassignedBadge">${totalGuests} unassigned</span>
              </div>
              <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-light" onclick="eventsModule.autoAssignGuests()" title="Auto Assign">
                  <i class="bi bi-magic me-1"></i>Auto Assign
                </button>
                <div class="btn-group btn-group-sm">
                  <button class="btn btn-sm btn-outline-light dropdown-toggle" data-bs-toggle="dropdown" data-bs-display="static">
                    <i class="bi bi-download me-1"></i>Export
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item" href="#" onclick="eventsModule.exportTablePlanExcel(); return false;"><i class="bi bi-file-earmark-spreadsheet text-success me-2"></i>Export Excel (.xlsx)</a></li>
                    <li><a class="dropdown-item" href="#" onclick="eventsModule.exportTablePlanPDF(); return false;"><i class="bi bi-printer text-primary me-2"></i>Print Document</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="#" onclick="eventsModule.openTVDisplay(); return false;"><i class="bi bi-tv text-info me-2"></i>TV / Projector Display</a></li>
                  </ul>
                </div>
                <button class="btn btn-sm btn-outline-light" onclick="eventsModule.showTablePlanStats()" title="Stats Summary">
                  <i class="bi bi-bar-chart"></i>
                </button>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
            </div>

            <div class="modal-body p-0">
              <div class="d-flex" style="height: calc(100vh - 56px); overflow: hidden;">

                <!-- Left Sidebar -->
                <div class="tp-sidebar border-end bg-light" style="width: 260px; min-width: 260px; display: flex; flex-direction: column;">

                  <!-- Room Setup Panel -->
                  <div id="tpSetupPanel" style="display: ${hasTables ? 'none' : 'block'};">
                    <div class="p-3 border-bottom" style="background: linear-gradient(135deg, #1a1a2e, #16213e); color: white;">
                      <h6 class="mb-1"><i class="bi bi-gear me-1"></i>Room Setup</h6>
                      <small class="opacity-75">Configure your table layout</small>
                    </div>
                    <div class="p-3">
                      <div class="mb-3">
                        <label class="form-label small fw-bold">Number of Tables</label>
                        <input type="number" class="form-control form-control-sm" id="tpSetupCount" value="10" min="1" max="50">
                      </div>
                      <div class="mb-3">
                        <label class="form-label small fw-bold">Seats per Table</label>
                        <select class="form-select form-select-sm" id="tpSetupSeats">
                          <option value="6">6 seats</option>
                          <option value="8" selected>8 seats</option>
                          <option value="10">10 seats</option>
                          <option value="12">12 seats</option>
                        </select>
                      </div>
                      <div class="mb-3">
                        <label class="form-label small fw-bold">Table Shape</label>
                        <div class="d-flex gap-2">
                          <label class="btn btn-sm btn-outline-secondary flex-fill active" id="tpShapeRoundLabel">
                            <input type="radio" name="tpSetupShape" value="round" checked class="d-none" onchange="document.getElementById('tpShapeRoundLabel').classList.add('active');document.getElementById('tpShapeRectLabel').classList.remove('active');">
                            <i class="bi bi-circle me-1"></i>Round
                          </label>
                          <label class="btn btn-sm btn-outline-secondary flex-fill" id="tpShapeRectLabel">
                            <input type="radio" name="tpSetupShape" value="rectangular" class="d-none" onchange="document.getElementById('tpShapeRectLabel').classList.add('active');document.getElementById('tpShapeRoundLabel').classList.remove('active');">
                            <i class="bi bi-square me-1"></i>Rectangular
                          </label>
                        </div>
                      </div>
                      <div class="mb-3">
                        <label class="form-label small fw-bold">Layout Style</label>
                        <select class="form-select form-select-sm" id="tpSetupLayout">
                          <option value="grid">Grid</option>
                          <option value="banquet">Banquet Rows</option>
                          <option value="circle">Circle / Horseshoe</option>
                        </select>
                      </div>
                      <button class="btn btn-primary w-100" onclick="eventsModule.generateTableLayout()">
                        <i class="bi bi-grid-3x3-gap me-1"></i>Generate Layout
                      </button>
                      ${hasTables ? `<button class="btn btn-sm btn-link text-muted w-100 mt-1" onclick="document.getElementById('tpSetupPanel').style.display='none'; document.getElementById('tpGuestsPanel').style.display='flex';">Cancel</button>` : ''}
                    </div>
                  </div>

                  <!-- Guests Panel (shown after tables are created) -->
                  <div id="tpGuestsPanel" style="display: ${hasTables ? 'flex' : 'none'}; flex-direction: column; flex: 1; min-height: 0;">
                    <div class="p-2 border-bottom">
                      <div class="input-group input-group-sm">
                        <span class="input-group-text"><i class="bi bi-search"></i></span>
                        <input type="text" class="form-control" id="tpGuestSearch" placeholder="Search guests or companies..." oninput="eventsModule.filterGuests(this.value)">
                      </div>
                    </div>

                    <!-- Room Elements Section -->
                    <div class="p-2 border-bottom">
                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <small class="fw-bold text-muted">ROOM ELEMENTS</small>
                        <button class="btn btn-sm btn-outline-secondary py-0 px-1" onclick="document.getElementById('tpSetupPanel').style.display='block'; document.getElementById('tpGuestsPanel').style.display='none';" title="Room Setup">
                          <i class="bi bi-gear" style="font-size: 0.75rem;"></i>
                        </button>
                      </div>
                      <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-outline-dark flex-fill" onclick="eventsModule.addRoomFixture('stage')" title="Add Stage">
                          <i class="bi bi-easel me-1"></i>Stage
                        </button>
                        <button class="btn btn-sm btn-outline-dark flex-fill" onclick="eventsModule.addRoomFixture('photowall')" title="Add Photo Wall">
                          <i class="bi bi-camera me-1"></i>Photo Wall
                        </button>
                        <button class="btn btn-sm btn-outline-dark flex-fill" onclick="eventsModule.addRoomFixture('av_booth')" title="Add AV Booth">
                          <i class="bi bi-soundwave me-1"></i>AV Booth
                        </button>
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

                </div>

                <!-- Main Canvas Area -->
                <div class="flex-grow-1 d-flex flex-column position-relative" style="min-width: 0; overflow: hidden;">
                  <!-- Canvas Toolbar -->
                  <div class="d-flex align-items-center gap-2 p-2 border-bottom bg-white" style="flex-wrap: wrap;">
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
                    <button class="btn btn-sm btn-outline-danger" onclick="eventsModule.resetCanvas()" title="Reset Canvas">
                      <i class="bi bi-arrow-counterclockwise me-1"></i>Reset
                    </button>
                    <small class="text-muted"><i class="bi bi-arrows-move me-1"></i>Drag to position. Drop guests onto tables.</small>
                  </div>

                  <!-- Canvas (the room) -->
                  <div id="tpCanvasWrapper" class="flex-grow-1 overflow-auto position-relative" style="background: #f0f2f5; background-image: radial-gradient(circle, #d0d0d0 1px, transparent 1px); background-size: 30px 30px;"
                       ondragover="eventsModule.handleCanvasDragOver(event)"
                       ondrop="eventsModule.handleCanvasDrop(event)">
                    <div id="tpCanvas" class="position-relative" style="width: 2400px; height: 1600px; transform-origin: 0 0;">
                      <!-- Tables rendered here as absolutely positioned elements -->
                    </div>
                  </div>

                  <!-- Right Panel: Table Detail (overlays canvas when a table is selected) -->
                  <div id="tpDetailPanel" class="border-start bg-white shadow-lg" style="width: 300px; min-width: 300px; display: none; flex-direction: column; position: absolute; right: 0; top: 0; bottom: 0; z-index: 10;">
                    <div id="tpDetailContent">
                      <!-- Filled when a table is clicked -->
                    </div>
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

        /* Room fixtures (stage, photowall, AV booth) */
        .tp-fixture {
          position: absolute; cursor: grab; user-select: none;
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
          z-index: 5; transition: box-shadow 0.2s;
        }
        .tp-fixture:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.15); z-index: 8; }
        .tp-fixture:active { cursor: grabbing; }
        .tp-fixture-selected {
          box-shadow: 0 0 0 3px rgba(111,66,193,0.5), 0 4px 15px rgba(0,0,0,0.2) !important;
          z-index: 9 !important;
        }
        .tp-fixture-label {
          font-weight: 700; font-size: 0.85rem; text-align: center; pointer-events: none;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .tp-fixture-actions {
          position: absolute; top: 4px; right: 4px; z-index: 10;
        }
        .tp-fixture-resize-handle {
          position: absolute; background: #6c757d; border-radius: 2px; z-index: 10;
          opacity: 0; transition: opacity 0.15s;
        }
        .tp-fixture:hover .tp-fixture-resize-handle,
        .tp-fixture-selected .tp-fixture-resize-handle { opacity: 1; }
        .tp-resize-se {
          bottom: -4px; right: -4px; width: 10px; height: 10px; cursor: nwse-resize;
          border-radius: 50%; background: #495057;
        }
        .tp-resize-e {
          right: -4px; top: 50%; transform: translateY(-50%);
          width: 6px; height: 20px; cursor: ew-resize;
        }
        .tp-resize-s {
          bottom: -4px; left: 50%; transform: translateX(-50%);
          width: 20px; height: 6px; cursor: ns-resize;
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

      if (tablesError) {
        // Table may not exist in database yet
        if (tablesError.code === '42P01' || tablesError.message?.includes('does not exist')) {
          this.tables = [];
          this.unassignedGuests = [];
          return;
        }
        throw tablesError;
      }
      this.tables = tables || [];

      // Load assignments for each table
      for (const table of this.tables) {
        const { data: assignments, error: assignError } = await STATE.client
          .from('table_assignments')
          .select('*')
          .eq('table_id', table.id);
        if (assignError && assignError.code !== '42P01') throw assignError;
        table.assignments = assignments || [];
      }

      // Load unassigned guests (RPC may not exist, fall back to direct query)
      try {
        const { data: unassigned, error: unassignedError } = await STATE.client
          .rpc('get_unassigned_guests', { p_event_id: this.currentEventIdTablePlan });
        if (!unassignedError && unassigned) {
          this.unassignedGuests = unassigned;
        } else {
          // Fallback: query event_guests directly, exclude those already assigned
          const assignedGuestIds = new Set();
          for (const t of this.tables) {
            (t.assignments || []).forEach(a => { if (a.guest_id) assignedGuestIds.add(a.guest_id); });
          }
          let guestQuery = STATE.client
            .from('event_guests')
            .select('id, guest_name, guest_email, organisation_id, guest_type, plus_ones, rsvp_status, dietary_requirements')
            .eq('event_id', this.currentEventIdTablePlan)
            .eq('rsvp_status', 'confirmed');

          const guestResult = await guestQuery;
          if (!guestResult.error && guestResult.data) {
            // Enrich with company name from organisations if possible
            const orgIds = [...new Set(guestResult.data.filter(g => g.organisation_id).map(g => g.organisation_id))];
            let orgMap = {};
            if (orgIds.length > 0) {
              const { data: orgs } = await STATE.client
                .from('organisations')
                .select('id, company_name')
                .in('id', orgIds);
              if (orgs) orgs.forEach(o => { orgMap[o.id] = o.company_name; });
            }
            this.unassignedGuests = guestResult.data
              .filter(g => !assignedGuestIds.has(g.id))
              .map(g => ({
                guest_id: g.id,
                guest_name: g.guest_name,
                guest_email: g.guest_email,
                organisation_id: g.organisation_id,
                company_name: orgMap[g.organisation_id] || null,
                guest_type: g.guest_type || 'guest',
                plus_ones: g.plus_ones || 0,
                rsvp_status: g.rsvp_status,
                dietary_requirements: g.dietary_requirements || null
              }));
          } else {
            this.unassignedGuests = [];
          }
        }
      } catch (rpcErr) {
        console.warn('Error loading unassigned guests:', rpcErr);
        this.unassignedGuests = [];
      }

      // Load room fixtures (stage, photowall, AV booth)
      try {
        const { data: fixtures, error: fixturesError } = await STATE.client
          .from('event_room_fixtures')
          .select('*')
          .eq('event_id', this.currentEventIdTablePlan);

        if (!fixturesError && fixtures) {
          this.roomFixtures = fixtures;
        } else {
          // Table may not exist - fall back to localStorage
          const key = `room_fixtures_${this.currentEventIdTablePlan}`;
          const stored = localStorage.getItem(key);
          this.roomFixtures = stored ? JSON.parse(stored) : [];
        }
      } catch (fixtureErr) {
        const key = `room_fixtures_${this.currentEventIdTablePlan}`;
        const stored = localStorage.getItem(key);
        this.roomFixtures = stored ? JSON.parse(stored) : [];
      }

    } catch (error) {
      console.error('Error loading table plan:', error);
      throw error;
    }
  },

  /**
   * Generate Table Layout - Batch create tables from setup wizard
   */
  async generateTableLayout() {
    const count = parseInt(document.getElementById('tpSetupCount')?.value) || 10;
    const seats = parseInt(document.getElementById('tpSetupSeats')?.value) || 8;
    const shape = document.querySelector('input[name="tpSetupShape"]:checked')?.value || 'round';
    const layout = document.getElementById('tpSetupLayout')?.value || 'grid';

    if (count < 1 || count > 50) {
      utils.showToast('Please enter between 1 and 50 tables', 'warning');
      return;
    }

    // Confirm if tables already exist
    if (this.tables.length > 0) {
      if (!await utils.confirmDialog({ title: 'Add Tables', message: `This will add ${count} new tables to the existing ${this.tables.length} tables. Continue?`, confirmText: 'Add Tables', danger: false })) return;
    }

    try {
      utils.showLoading();

      // Calculate positions based on layout style
      const positions = this._calculateLayoutPositions(count, layout, shape, seats);

      // Get starting table number
      const maxNum = this.tables.reduce((max, t) => Math.max(max, t.table_number || 0), 0);

      // Batch insert all tables
      const tablesToInsert = positions.map((pos, i) => ({
        event_id: this.currentEventIdTablePlan,
        table_number: maxNum + i + 1,
        total_seats: seats,
        shape: shape,
        position_x: pos.x,
        position_y: pos.y
      }));

      const { error } = await STATE.client
        .from('event_tables')
        .insert(tablesToInsert);

      if (error) throw error;

      utils.showToast(`${count} tables created`, 'success');

      // Reload and re-render
      await this.loadTablePlan();

      // Switch to guests panel
      const setupPanel = document.getElementById('tpSetupPanel');
      const guestsPanel = document.getElementById('tpGuestsPanel');
      if (setupPanel) setupPanel.style.display = 'none';
      if (guestsPanel) guestsPanel.style.display = 'flex';

      this.renderUnassignedGuests();
      this.renderCanvasTables();

      // Update badges
      const totalSeated = this.tables.reduce((sum, t) => sum + (t.assignments?.length || 0), 0);
      const seatedBadge = document.getElementById('tpSeatedBadge');
      const unassignedBadge = document.getElementById('tpUnassignedBadge');
      if (seatedBadge) seatedBadge.textContent = totalSeated + ' seated';
      if (unassignedBadge) unassignedBadge.textContent = this.unassignedGuests.length + ' unassigned';

    } catch (error) {
      console.error('Error generating table layout:', error);
      utils.showToast('Failed to generate layout: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Calculate table positions for different layout styles
   */
  _calculateLayoutPositions(count, layout, shape, seats) {
    const positions = [];
    // Table size depends on shape and seats
    const tableSize = shape === 'rectangular' ? Math.max(140, 50 + seats * 12) : Math.max(110, 50 + seats * 8);
    const spacing = tableSize + 60; // gap between tables

    if (layout === 'grid') {
      // Even grid layout
      const cols = Math.ceil(Math.sqrt(count * 1.5)); // slightly wider than tall
      const startX = 120;
      const startY = 100;
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.push({
          x: startX + col * spacing,
          y: startY + row * spacing
        });
      }
    } else if (layout === 'banquet') {
      // Two columns with aisle
      const rows = Math.ceil(count / 2);
      const startX = 200;
      const startY = 100;
      const aisleWidth = spacing + 80;
      for (let i = 0; i < count; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        positions.push({
          x: startX + col * aisleWidth,
          y: startY + row * spacing
        });
      }
    } else if (layout === 'circle') {
      // Circle/horseshoe arrangement
      const centerX = 800;
      const centerY = 700;
      const radius = Math.max(250, count * spacing / (2 * Math.PI));
      for (let i = 0; i < count; i++) {
        // Spread around ~300 degrees (horseshoe, open at bottom)
        const angle = (Math.PI * 1.2) + (i / (count)) * (Math.PI * 1.6);
        positions.push({
          x: Math.round(centerX + radius * Math.cos(angle)),
          y: Math.round(centerY + radius * Math.sin(angle))
        });
      }
    }

    return positions;
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

    if (this.tables.length === 0 && this.roomFixtures.length === 0) {
      canvas.innerHTML = `
        <div class="position-absolute d-flex align-items-center justify-content-center" style="inset:0;">
          <div class="text-center text-muted">
            <i class="bi bi-grid-3x3-gap display-3 d-block mb-3 opacity-25"></i>
            <p>Click <strong>Add Table</strong> or add <strong>Room Elements</strong> to start</p>
          </div>
        </div>`;
      return;
    }

    // Render fixtures (stage, photowall, AV booth)
    const fixturesHtml = this._renderFixtures();

    canvas.innerHTML = fixturesHtml + this.tables.map(table => {
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

  // ==== ROOM FIXTURES (Stage, Photo Wall, AV Booth) ====

  _fixtureConfig: {
    stage:     { label: 'Stage',      icon: 'bi-easel',     color: '#6f42c1', bg: '#f3e8ff', defaultW: 400, defaultH: 150 },
    photowall: { label: 'Photo Wall', icon: 'bi-camera',    color: '#0d6efd', bg: '#e7f1ff', defaultW: 200, defaultH: 80  },
    av_booth:  { label: 'AV Booth',   icon: 'bi-soundwave', color: '#198754', bg: '#e8f5e9', defaultW: 120, defaultH: 100 }
  },

  /**
   * Add a room fixture to the canvas
   */
  async addRoomFixture(type) {
    const config = this._fixtureConfig[type];
    if (!config) return;

    const id = 'fixture_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const fixture = {
      id,
      event_id: this.currentEventIdTablePlan,
      fixture_type: type,
      label: config.label,
      position_x: 100 + this.roomFixtures.length * 50,
      position_y: 50 + this.roomFixtures.length * 30,
      width: config.defaultW,
      height: config.defaultH
    };

    // Try saving to DB first, fall back to localStorage
    try {
      const { data, error } = await STATE.client
        .from('event_room_fixtures')
        .insert([fixture])
        .select()
        .single();

      if (!error && data) {
        fixture.id = data.id;
        this.roomFixtures.push(fixture);
      } else {
        this.roomFixtures.push(fixture);
        this._saveFixturesToLocalStorage();
      }
    } catch (e) {
      this.roomFixtures.push(fixture);
      this._saveFixturesToLocalStorage();
    }

    this.renderCanvasTables();
    utils.showToast(`${config.label} added`, 'success');
  },

  /**
   * Render all room fixtures as HTML elements
   */
  _renderFixtures() {
    return this.roomFixtures.map(f => {
      const config = this._fixtureConfig[f.fixture_type] || this._fixtureConfig.stage;
      const selected = f.id === this._selectedFixtureId;
      const label = f.label || config.label;

      return `
        <div class="tp-fixture ${selected ? 'tp-fixture-selected' : ''}"
             data-fixture-id="${f.id}"
             style="left:${f.position_x}px; top:${f.position_y}px; width:${f.width}px; height:${f.height}px;
                    background: ${config.bg}; border: 2.5px ${f.fixture_type === 'stage' ? 'double' : 'dashed'} ${config.color};"
             onmousedown="eventsModule.startFixtureDrag(event, '${f.id}')">
          <div class="tp-fixture-label" style="color:${config.color};">
            <i class="bi ${config.icon} me-1"></i>${utils.escapeHtml(label)}
          </div>
          ${selected ? `<div class="tp-fixture-actions">
            <button class="btn btn-sm btn-outline-danger py-0 px-1" onmousedown="event.stopPropagation();" onclick="eventsModule.removeFixture('${f.id}')" title="Remove">
              <i class="bi bi-trash" style="font-size:0.7rem;"></i>
            </button>
          </div>` : ''}
          <div class="tp-fixture-resize-handle tp-resize-se" onmousedown="eventsModule.startFixtureResize(event, '${f.id}', 'se')"></div>
          <div class="tp-fixture-resize-handle tp-resize-e" onmousedown="eventsModule.startFixtureResize(event, '${f.id}', 'e')"></div>
          <div class="tp-fixture-resize-handle tp-resize-s" onmousedown="eventsModule.startFixtureResize(event, '${f.id}', 's')"></div>
        </div>`;
    }).join('');
  },

  /**
   * Start dragging a fixture to reposition it
   */
  startFixtureDrag(event, fixtureId) {
    if (event.button !== 0) return;

    // Select the fixture
    this._selectedFixtureId = fixtureId;
    this._selectedTableId = null;
    const panel = document.getElementById('tpDetailPanel');
    if (panel) panel.style.display = 'none';

    const el = event.currentTarget;
    this._fixtureDrag = {
      fixtureId,
      el,
      startX: event.clientX,
      startY: event.clientY,
      origLeft: parseInt(el.style.left) || 0,
      origTop: parseInt(el.style.top) || 0,
      moved: false
    };

    const onMove = (e) => {
      if (!this._fixtureDrag) return;
      const dx = (e.clientX - this._fixtureDrag.startX) / this._canvasZoom;
      const dy = (e.clientY - this._fixtureDrag.startY) / this._canvasZoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._fixtureDrag.moved = true;
      this._fixtureDrag.el.style.left = Math.max(0, this._fixtureDrag.origLeft + dx) + 'px';
      this._fixtureDrag.el.style.top = Math.max(0, this._fixtureDrag.origTop + dy) + 'px';
    };

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!this._fixtureDrag) return;

      if (this._fixtureDrag.moved) {
        const newX = Math.max(0, Math.round(parseInt(this._fixtureDrag.el.style.left)));
        const newY = Math.max(0, Math.round(parseInt(this._fixtureDrag.el.style.top)));
        const fixture = this.roomFixtures.find(f => f.id === fixtureId);
        if (fixture) {
          fixture.position_x = newX;
          fixture.position_y = newY;
          await this._saveFixture(fixture);
        }
      }

      this._fixtureDrag = null;
      this.renderCanvasTables();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    event.preventDefault();
    event.stopPropagation();
  },

  /**
   * Start resizing a fixture via a corner/edge handle
   */
  startFixtureResize(event, fixtureId, handle) {
    event.preventDefault();
    event.stopPropagation();

    const fixture = this.roomFixtures.find(f => f.id === fixtureId);
    if (!fixture) return;

    const el = document.querySelector(`[data-fixture-id="${fixtureId}"]`);
    if (!el) return;

    this._fixtureResize = {
      fixtureId,
      el,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origW: fixture.width,
      origH: fixture.height
    };

    const onMove = (e) => {
      if (!this._fixtureResize) return;
      const dx = (e.clientX - this._fixtureResize.startX) / this._canvasZoom;
      const dy = (e.clientY - this._fixtureResize.startY) / this._canvasZoom;

      let newW = this._fixtureResize.origW;
      let newH = this._fixtureResize.origH;

      if (handle === 'se' || handle === 'e') newW = Math.max(60, this._fixtureResize.origW + dx);
      if (handle === 'se' || handle === 's') newH = Math.max(40, this._fixtureResize.origH + dy);

      this._fixtureResize.el.style.width = newW + 'px';
      this._fixtureResize.el.style.height = newH + 'px';
    };

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!this._fixtureResize) return;

      const newW = Math.max(60, Math.round(parseInt(this._fixtureResize.el.style.width)));
      const newH = Math.max(40, Math.round(parseInt(this._fixtureResize.el.style.height)));

      const fixture = this.roomFixtures.find(f => f.id === fixtureId);
      if (fixture) {
        fixture.width = newW;
        fixture.height = newH;
        await this._saveFixture(fixture);
      }

      this._fixtureResize = null;
      this.renderCanvasTables();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  },

  /**
   * Remove a fixture from the canvas
   */
  async removeFixture(fixtureId) {
    if (!await utils.confirmDialog({ title: 'Remove Element', message: 'Remove this element?', confirmText: 'Remove' })) return;

    this.roomFixtures = this.roomFixtures.filter(f => f.id !== fixtureId);
    if (this._selectedFixtureId === fixtureId) this._selectedFixtureId = null;

    try {
      await STATE.client
        .from('event_room_fixtures')
        .delete()
        .eq('id', fixtureId);
    } catch (e) {
      // Fall back to localStorage
    }
    this._saveFixturesToLocalStorage();
    this.renderCanvasTables();
    utils.showToast('Element removed', 'success');
  },

  /**
   * Save a single fixture to DB or localStorage
   */
  async _saveFixture(fixture) {
    try {
      const { error } = await STATE.client
        .from('event_room_fixtures')
        .upsert({
          id: fixture.id,
          event_id: fixture.event_id,
          fixture_type: fixture.fixture_type,
          label: fixture.label,
          position_x: fixture.position_x,
          position_y: fixture.position_y,
          width: fixture.width,
          height: fixture.height
        });
      if (error) throw error;
    } catch (e) {
      this._saveFixturesToLocalStorage();
    }
  },

  _saveFixturesToLocalStorage() {
    const key = `room_fixtures_${this.currentEventIdTablePlan}`;
    localStorage.setItem(key, JSON.stringify(this.roomFixtures));
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
    this._selectedFixtureId = null; // Deselect any fixture
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
    const availableSeats = table.total_seats - assignedCount;

    // Build organisation picker — group unassigned guests by company, VIP first
    const orgGroups = this._groupGuestsByCompany(this.unassignedGuests);
    // Score each company: VIP/sponsor guests get priority
    const vipTypes = new Set(['vip', 'sponsor', 'speaker']);
    const companyPriority = (key) => {
      const grp = orgGroups[key];
      if (!grp || key === '__none__') return 0;
      const hasVip = grp.guests.some(g => vipTypes.has(g.guest_type));
      return hasVip ? 2 : 1;
    };
    const companies = Object.keys(orgGroups)
      .sort((a, b) => {
        const pa = companyPriority(a), pb = companyPriority(b);
        if (pa !== pb) return pb - pa; // VIP first
        if (a === '__none__') return 1;
        if (b === '__none__') return -1;
        return a.localeCompare(b);
      });

    const orgPickerHtml = availableSeats > 0 && companies.length > 0 ? `
      <div class="mb-2">
        <small class="fw-bold text-muted d-block mb-1">ASSIGN ORGANISATION</small>
        <input type="text" class="form-control form-control-sm mb-1" id="tpOrgSearch" placeholder="Search companies..." oninput="eventsModule._filterOrgPicker(this.value)">
        <div id="tpOrgPickerList" style="max-height: 180px; overflow-y: auto;">
          ${companies.map(key => {
            const grp = orgGroups[key];
            const name = grp.company_name || 'No Company';
            const guestCount = grp.guests.length;
            const fitsAll = guestCount <= availableSeats;
            const hasVip = grp.guests.some(g => vipTypes.has(g.guest_type));
            const vipBadge = hasVip ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;">VIP</span>' : '';
            return `<div class="tp-org-pick-item d-flex align-items-center justify-content-between p-2 mb-1 rounded border" style="cursor:pointer; font-size:0.82rem; background:${hasVip ? '#fff8e1' : '#f8f9fa'}; transition: background 0.15s; ${hasVip ? 'border-color:#ffc107 !important;' : ''}"
              onmouseover="this.style.background='#e3f2fd'"
              onmouseout="this.style.background='${hasVip ? '#fff8e1' : '#f8f9fa'}'"
              data-org-name="${utils.escapeHtml(name).toLowerCase()}"
              onclick="eventsModule.assignOrgToTable('${table.id}', ${JSON.stringify(key).replace(/'/g, '\\x27')})">
              <div>
                <div class="fw-medium"><i class="bi bi-building me-1 text-muted"></i>${utils.escapeHtml(name)}${vipBadge}</div>
                <small class="text-muted">${guestCount} guest${guestCount !== 1 ? 's' : ''}</small>
              </div>
              <span class="badge ${fitsAll ? 'bg-success' : 'bg-warning text-dark'}">${fitsAll ? 'Fits' : guestCount + '/' + availableSeats}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
      <hr>
    ` : availableSeats === 0 ? `
      <div class="alert alert-info py-2 mb-2" style="font-size:0.8rem;"><i class="bi bi-check-circle me-1"></i>Table is full</div>
    ` : '';

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
        <button class="btn btn-sm btn-primary mb-2" onclick="eventsModule.saveTableProperties('${table.id}')">
          <i class="bi bi-check-lg me-1"></i>Save Changes
        </button>
        <div class="d-flex gap-2 mb-2">
          <button class="btn btn-sm btn-outline-secondary flex-fill" onclick="eventsModule.duplicateTable('${table.id}')">
            <i class="bi bi-copy me-1"></i>Duplicate
          </button>
          <button class="btn btn-sm btn-outline-warning flex-fill" onclick="eventsModule.clearTable('${table.id}')" ${assignedCount === 0 ? 'disabled' : ''}>
            <i class="bi bi-eraser me-1"></i>Clear All
          </button>
          <button class="btn btn-sm btn-outline-danger flex-fill" onclick="eventsModule.deleteTable('${table.id}')">
            <i class="bi bi-trash me-1"></i>Delete
          </button>
        </div>
        <hr>
        ${orgPickerHtml}
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
          `).join('') : '<p class="text-muted small text-center mt-3">Click a company above or drag guests from the left panel</p>'}
        </div>
      </div>
    `;

    panel.style.display = 'flex';
  },

  /**
   * Filter organisation picker in detail panel
   */
  _filterOrgPicker(term) {
    const items = document.querySelectorAll('#tpOrgPickerList .tp-org-pick-item');
    const search = (term || '').toLowerCase();
    items.forEach(el => {
      const name = el.getAttribute('data-org-name') || '';
      el.style.display = name.includes(search) ? '' : 'none';
    });
  },

  /**
   * Assign an entire organisation's guests to a table
   */
  async assignOrgToTable(tableId, orgKey) {
    const table = this.tables.find(t => t.id === tableId);
    if (!table) return;

    const assignedCount = table.assignments?.length || 0;
    const availableSeats = table.total_seats - assignedCount;

    // Get guests for this org from unassigned list
    const guests = this.unassignedGuests.filter(g => {
      const key = g.company_name || '__none__';
      return key === orgKey;
    });

    if (guests.length === 0) {
      utils.showToast('No unassigned guests for this organisation', 'warning');
      return;
    }

    const toAssign = guests.slice(0, availableSeats);
    if (toAssign.length < guests.length) {
      if (!await utils.confirmDialog({ title: 'Limited Seats', message: `Only ${availableSeats} seat(s) available. Assign ${toAssign.length} of ${guests.length} guests?`, confirmText: 'Assign', danger: false })) return;
    }

    try {
      // Calculate taken seat numbers to auto-assign
      const takenSeats = new Set((table.assignments || []).map(a => a.seat_number).filter(Boolean));
      const nextSeat = () => {
        for (let s = 1; s <= table.total_seats + 10; s++) {
          if (!takenSeats.has(s)) { takenSeats.add(s); return s; }
        }
        return null;
      };

      const assignments = toAssign.map(g => ({
        event_id: this.currentEventIdTablePlan,
        table_id: tableId,
        guest_id: g.guest_id || g.id,
        guest_name: g.guest_name,
        organisation_id: g.organisation_id || null,
        company_name: g.company_name || null,
        seat_number: nextSeat(),
        dietary_requirements: g.dietary_requirements || null
      }));

      const { error } = await STATE.client
        .from('table_assignments')
        .insert(assignments);

      if (error) throw error;

      utils.showToast(`${toAssign.length} guest(s) assigned`, 'success');

      await this.loadTablePlan();
      this.renderUnassignedGuests();
      this.renderCanvasTables();
      this.showTableDetail(tableId);
      this._updateHeaderBadges();

    } catch (error) {
      console.error('Error assigning org to table:', error);
      utils.showToast('Failed to assign guests: ' + error.message, 'error');
    }
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

    // Validate seat count vs assigned guests
    const table = this.tables.find(t => t.id === tableId);
    const assignedCount = table?.assignments?.length || 0;
    if (seats < assignedCount) {
      utils.showToast(`Cannot reduce to ${seats} seats — ${assignedCount} guest(s) already assigned. Remove guests first.`, 'warning');
      return;
    }

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

    // Calculate taken seat numbers to auto-assign next available
    const takenSeats = new Set((table.assignments || []).map(a => a.seat_number).filter(Boolean));
    const _nextSeat = (offset) => {
      for (let s = 1; s <= table.total_seats + offset + 10; s++) {
        if (!takenSeats.has(s)) { takenSeats.add(s); return s; }
      }
      return null;
    };

    if (this.draggedGuestIsCompany && this.draggedCompanyGuests.length > 0) {
      // Bulk assign all company guests
      const availableSeats = table.total_seats - assignedCount;
      const toAssign = this.draggedCompanyGuests.slice(0, availableSeats);
      if (toAssign.length === 0) {
        utils.showToast('Table is full!', 'warning');
        return;
      }
      try {
        const rows = toAssign.map((g, i) => ({
          event_id: this.currentEventIdTablePlan,
          table_id: tableId,
          guest_id: g.guest_id || g.id,
          guest_name: g.guest_name,
          organisation_id: g.organisation_id || null,
          company_name: g.company_name || null,
          seat_number: _nextSeat(i),
          dietary_requirements: g.dietary_requirements || null
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
        this._updateHeaderBadges();
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
        // Look up full guest data for dietary info
        const fullGuest = this.unassignedGuests.find(g =>
          (g.guest_id || g.id) === this.draggedGuestData.guest_id);
        const { error } = await STATE.client
          .from('table_assignments')
          .insert([{
            event_id: this.currentEventIdTablePlan,
            table_id: tableId,
            guest_id: this.draggedGuestData.guest_id,
            guest_name: this.draggedGuestData.guest_name,
            organisation_id: this.draggedGuestData.organisation_id || null,
            company_name: this.draggedGuestData.company_name || null,
            seat_number: _nextSeat(0),
            dietary_requirements: fullGuest?.dietary_requirements || null
          }]);
        if (error) throw error;
        utils.showToast('Guest assigned to table', 'success');
        await this.loadTablePlan();
        this.renderUnassignedGuests();
        this.renderCanvasTables();
        if (this._selectedTableId === tableId) this.showTableDetail(tableId);
        this._updateHeaderBadges();
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
      let nextNumber;
      const { data: rpcResult, error: numberError } = await STATE.client
        .rpc('get_next_table_number', { p_event_id: this.currentEventIdTablePlan });
      if (numberError) {
        // RPC may not exist - compute next table number client-side
        console.warn('get_next_table_number RPC not available, computing locally');
        const maxNum = this.tables.reduce((max, t) => Math.max(max, t.table_number || 0), 0);
        nextNumber = maxNum + 1;
      } else {
        nextNumber = rpcResult;
      }

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
    const table = this.tables.find(t => t.id === tableId);
    const assignedCount = table?.assignments?.length || 0;
    const msg = assignedCount > 0
      ? `Delete this table? ${assignedCount} seated guest(s) will be unassigned.`
      : 'Delete this table?';
    if (!await utils.confirmDialog({ title: 'Delete Table', message: msg })) return;

    try {
      // Remove all assignments first to avoid orphaned records
      if (assignedCount > 0) {
        const { error: clearError } = await STATE.client
          .from('table_assignments')
          .delete()
          .eq('table_id', tableId);
        if (clearError) throw clearError;
      }

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
      this._updateHeaderBadges();
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
      this._updateHeaderBadges();
    } catch (error) {
      console.error('Error removing guest:', error);
      utils.showToast('Failed to remove guest', 'error');
    }
  },

  _updateHeaderBadges() {
    const totalSeated = this.tables.reduce((sum, t) => sum + (t.assignments?.length || 0), 0);
    const seatedBadge = document.getElementById('tpSeatedBadge');
    const unassignedBadge = document.getElementById('tpUnassignedBadge');
    if (seatedBadge) seatedBadge.textContent = totalSeated + ' seated';
    if (unassignedBadge) unassignedBadge.textContent = this.unassignedGuests.length + ' unassigned';
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

    if (!await utils.confirmDialog({ title: 'Auto-Assign Guests', message: `Auto-assign ${guestsToAssign} guest(s) across ${tablesWithSpace.length} table(s)?<br><br>Guests from the same company will be kept together where possible.`, confirmText: 'Auto-Assign', danger: false })) {
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

          // Auto-assign next available seat number
          if (!targetTable._takenSeats) {
            targetTable._takenSeats = new Set((targetTable.assignments || []).map(a => a.seat_number).filter(Boolean));
          }
          let seatNum = null;
          for (let s = 1; s <= targetTable.total_seats + 10; s++) {
            if (!targetTable._takenSeats.has(s)) { seatNum = s; targetTable._takenSeats.add(s); break; }
          }

          const { error } = await STATE.client
            .from('table_assignments')
            .insert([{
              event_id: this.currentEventIdTablePlan,
              table_id: targetTable.id,
              guest_id: guest.guest_id || guest.id,
              guest_name: guest.guest_name,
              organisation_id: guest.organisation_id || null,
              company_name: guest.company_name || null,
              seat_number: seatNum,
              dietary_requirements: guest.dietary_requirements || null
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
      this._updateHeaderBadges();

    } catch (error) {
      console.error('Error auto-assigning guests:', error);
      utils.showToast('Failed to auto-assign guests: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ---- EXCEL EXPORT ----

  async exportTablePlanExcel() {
    if (this.tables.length === 0) {
      utils.showToast('No tables to export', 'warning');
      return;
    }

    try {
      // Load SheetJS if not already loaded
      if (typeof XLSX === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Excel library'));
          document.head.appendChild(script);
        });
      }

      const wb = XLSX.utils.book_new();
      const sortedTables = [...this.tables].sort((a, b) => a.table_number - b.table_number);

      // ---- Sheet 1: By Table Number ----
      const byTableRows = [];
      sortedTables.forEach(table => {
        const label = table.table_name || '';
        if (table.assignments && table.assignments.length > 0) {
          [...table.assignments]
            .sort((a, b) => (a.guest_name || '').localeCompare(b.guest_name || ''))
            .forEach(a => {
              byTableRows.push({
                'Table #': table.table_number,
                'Table Name': label,
                'Seats': table.total_seats,
                'Occupied': table.assignments.length,
                'Guest Name': a.guest_name || '',
                'Company': a.company_name || '',
                'Seat #': a.seat_number || '',
                'VIP': a.is_vip ? 'Yes' : '',
                'Dietary': a.dietary_requirements || '',
                'Notes': a.notes || ''
              });
            });
        } else {
          byTableRows.push({
            'Table #': table.table_number,
            'Table Name': label,
            'Seats': table.total_seats,
            'Occupied': 0,
            'Guest Name': '',
            'Company': '',
            'Seat #': '',
            'VIP': '',
            'Dietary': '',
            'Notes': ''
          });
        }
      });

      const ws1 = XLSX.utils.json_to_sheet(byTableRows);
      ws1['!cols'] = [
        { wch: 8 },   // Table #
        { wch: 20 },  // Table Name
        { wch: 6 },   // Seats
        { wch: 9 },   // Occupied
        { wch: 28 },  // Guest Name
        { wch: 28 },  // Company
        { wch: 7 },   // Seat #
        { wch: 5 },   // VIP
        { wch: 20 },  // Dietary
        { wch: 20 }   // Notes
      ];
      ws1['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: byTableRows.length, c: 9 } }) };
      XLSX.utils.book_append_sheet(wb, ws1, 'By Table');

      // ---- Sheet 2: By Company (A-Z) ----
      const allGuests = [];
      sortedTables.forEach(table => {
        (table.assignments || []).forEach(a => {
          allGuests.push({
            'Company': a.company_name || '',
            'Guest Name': a.guest_name || '',
            'Table #': table.table_number,
            'Table Name': table.table_name || '',
            'Seat #': a.seat_number || '',
            'VIP': a.is_vip ? 'Yes' : '',
            'Dietary': a.dietary_requirements || ''
          });
        });
      });
      allGuests.sort((a, b) => (a['Company'] || '').localeCompare(b['Company'] || '') || (a['Guest Name'] || '').localeCompare(b['Guest Name'] || ''));

      const ws2 = XLSX.utils.json_to_sheet(allGuests);
      ws2['!cols'] = [
        { wch: 28 },  // Company
        { wch: 28 },  // Guest Name
        { wch: 8 },   // Table #
        { wch: 20 },  // Table Name
        { wch: 7 },   // Seat #
        { wch: 5 },   // VIP
        { wch: 20 }   // Dietary
      ];
      ws2['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: allGuests.length, c: 6 } }) };
      XLSX.utils.book_append_sheet(wb, ws2, 'By Company');

      // ---- Sheet 3: Guest A-Z ----
      const guestAZ = [...allGuests].sort((a, b) => (a['Guest Name'] || '').localeCompare(b['Guest Name'] || ''));
      const guestRows = guestAZ.map(g => ({
        'Guest Name': g['Guest Name'],
        'Company': g['Company'],
        'Table #': g['Table #'],
        'Table Name': g['Table Name'],
        'Seat #': g['Seat #'],
        'VIP': g['VIP'],
        'Dietary': g['Dietary']
      }));

      const ws3 = XLSX.utils.json_to_sheet(guestRows);
      ws3['!cols'] = [
        { wch: 28 },  // Guest Name
        { wch: 28 },  // Company
        { wch: 8 },   // Table #
        { wch: 20 },  // Table Name
        { wch: 7 },   // Seat #
        { wch: 5 },   // VIP
        { wch: 20 }   // Dietary
      ];
      ws3['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: guestRows.length, c: 6 } }) };
      XLSX.utils.book_append_sheet(wb, ws3, 'Guest A-Z');

      // ---- Sheet 4: Unassigned (if any) ----
      if (this.unassignedGuests.length > 0) {
        const unassignedRows = [...this.unassignedGuests]
          .sort((a, b) => (a.guest_name || '').localeCompare(b.guest_name || ''))
          .map(g => ({
            'Guest Name': g.guest_name || '',
            'Company': g.company_name || '',
            'Email': g.guest_email || '',
            'RSVP Status': g.rsvp_status || ''
          }));
        const ws4 = XLSX.utils.json_to_sheet(unassignedRows);
        ws4['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 30 }, { wch: 14 }];
        ws4['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: unassignedRows.length, c: 3 } }) };
        XLSX.utils.book_append_sheet(wb, ws4, 'Unassigned');
      }

      // ---- Sheet 5: Summary ----
      const totalSeats = sortedTables.reduce((s, t) => s + t.total_seats, 0);
      const totalSeated = sortedTables.reduce((s, t) => s + (t.assignments?.length || 0), 0);
      const summaryRows = sortedTables.map(t => ({
        'Table #': t.table_number,
        'Table Name': t.table_name || '',
        'Shape': t.shape || 'round',
        'Total Seats': t.total_seats,
        'Occupied': t.assignments?.length || 0,
        'Available': t.total_seats - (t.assignments?.length || 0),
        'Occupancy %': t.total_seats > 0 ? Math.round((t.assignments?.length || 0) / t.total_seats * 100) : 0
      }));
      // Add totals row
      summaryRows.push({
        'Table #': '',
        'Table Name': 'TOTAL',
        'Shape': '',
        'Total Seats': totalSeats,
        'Occupied': totalSeated,
        'Available': totalSeats - totalSeated,
        'Occupancy %': totalSeats > 0 ? Math.round(totalSeated / totalSeats * 100) : 0
      });

      const ws5 = XLSX.utils.json_to_sheet(summaryRows);
      ws5['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 11 }, { wch: 9 }, { wch: 9 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws5, 'Summary');

      // Download
      const safeName = (this.currentEventNameTablePlan || 'Event').replace(/[^a-z0-9]/gi, '_');
      XLSX.writeFile(wb, `${safeName}_Table_Plan_${new Date().toISOString().split('T')[0]}.xlsx`);
      utils.showToast('Excel spreadsheet exported successfully', 'success');

    } catch (error) {
      console.error('Error exporting Excel:', error);
      utils.showToast('Failed to export spreadsheet: ' + error.message, 'error');
    }
  },

  // ---- PRINTABLE TABLE PLAN DOCUMENT ----

  exportTablePlanPDF() {
    if (this.tables.length === 0) {
      utils.showToast('No tables to export', 'warning');
      return;
    }

    const esc = s => utils.escapeHtml(s || '');
    const eventName = this.currentEventNameTablePlan || 'Event';
    const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const totalSeats = this.tables.reduce((s, t) => s + t.total_seats, 0);
    const totalSeated = this.tables.reduce((s, t) => s + (t.assignments?.length || 0), 0);
    const occupancyPct = totalSeats > 0 ? Math.round(totalSeated / totalSeats * 100) : 0;

    // Sort tables by table_number
    const sortedTables = [...this.tables].sort((a, b) => a.table_number - b.table_number);

    // Build table cards HTML
    const tableCardsHtml = sortedTables.map(table => {
      const assigned = table.assignments?.length || 0;
      const label = table.table_name
        ? `${esc(table.table_name)} <span class="table-num">(Table ${table.table_number})</span>`
        : `Table ${table.table_number}`;
      const shapeLabel = (table.shape || 'round').charAt(0).toUpperCase() + (table.shape || 'round').slice(1);

      let guestsHtml = '';
      if (table.assignments && table.assignments.length > 0) {
        const sortedGuests = [...table.assignments].sort((a, b) =>
          (a.guest_name || '').localeCompare(b.guest_name || ''));
        guestsHtml = sortedGuests.map(a => `
          <tr>
            <td class="guest-name">${esc(a.guest_name)}${a.is_vip ? ' <span class="vip-badge">VIP</span>' : ''}</td>
            <td class="guest-company">${esc(a.company_name)}</td>
            <td class="guest-seat">${a.seat_number || '-'}</td>
            <td class="guest-dietary">${esc(a.dietary_requirements)}</td>
          </tr>
        `).join('');
      } else {
        guestsHtml = '<tr><td colspan="4" class="empty-table">No guests assigned</td></tr>';
      }

      return `
        <div class="table-card">
          <div class="table-header">
            <div class="table-title">${label}</div>
            <div class="table-meta">${shapeLabel} &middot; ${assigned}/${table.total_seats} seats</div>
          </div>
          <table class="guest-table">
            <thead>
              <tr><th>Guest</th><th>Company</th><th>Seat</th><th>Dietary</th></tr>
            </thead>
            <tbody>${guestsHtml}</tbody>
          </table>
          ${table.notes ? `<div class="table-notes">Note: ${esc(table.notes)}</div>` : ''}
        </div>
      `;
    }).join('');

    // Build alphabetical guest directory
    const allGuests = [];
    sortedTables.forEach(table => {
      (table.assignments || []).forEach(a => {
        allGuests.push({
          name: a.guest_name || '',
          company: a.company_name || '',
          tableNum: table.table_number,
          tableName: table.table_name || '',
          seat: a.seat_number || '-',
          vip: a.is_vip,
          dietary: a.dietary_requirements || ''
        });
      });
    });
    allGuests.sort((a, b) => a.name.localeCompare(b.name));

    const directoryHtml = allGuests.length > 0 ? allGuests.map(g => `
      <tr>
        <td class="guest-name">${esc(g.name)}${g.vip ? ' <span class="vip-badge">VIP</span>' : ''}</td>
        <td>${esc(g.company)}</td>
        <td class="table-ref"><strong>${g.tableNum}</strong>${g.tableName ? ` - ${esc(g.tableName)}` : ''}</td>
        <td class="guest-seat">${g.seat}</td>
      </tr>
    `).join('') : '<tr><td colspan="4">No guests assigned yet</td></tr>';

    // Unassigned guests section
    let unassignedHtml = '';
    if (this.unassignedGuests.length > 0) {
      const sortedUnassigned = [...this.unassignedGuests].sort((a, b) =>
        (a.guest_name || '').localeCompare(b.guest_name || ''));
      unassignedHtml = `
        <div class="section-break"></div>
        <h2 class="section-title unassigned-title">Unassigned Guests (${this.unassignedGuests.length})</h2>
        <table class="directory-table unassigned-table">
          <thead><tr><th>Guest</th><th>Company</th><th>Email</th></tr></thead>
          <tbody>
            ${sortedUnassigned.map(g => `
              <tr>
                <td>${esc(g.guest_name)}</td>
                <td>${esc(g.company_name)}</td>
                <td>${esc(g.guest_email)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      utils.showToast('Please allow popups to open the print view', 'warning');
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Table Plan - ${esc(eventName)}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a2e; font-size: 10pt; line-height: 1.4;
    }

    /* ---- Cover Page ---- */
    .cover {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 90vh; text-align: center; page-break-after: always;
    }
    .cover h1 { font-size: 32pt; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; }
    .cover .event-name { font-size: 18pt; color: #0d6efd; font-weight: 600; margin-bottom: 20px; }
    .cover .date { font-size: 11pt; color: #888; margin-bottom: 40px; }
    .cover .stats-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
      max-width: 500px; width: 100%;
    }
    .cover .stat-box {
      border: 2px solid #e9ecef; border-radius: 10px; padding: 16px 8px;
    }
    .cover .stat-box .num { font-size: 28pt; font-weight: 800; color: #1a1a2e; }
    .cover .stat-box .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-top: 2px; }
    .cover .stat-box.highlight { border-color: #0d6efd; }
    .cover .stat-box.highlight .num { color: #0d6efd; }
    .cover .stat-box.warning { border-color: #ffc107; }
    .cover .stat-box.warning .num { color: #dc3545; }

    /* ---- Section Titles ---- */
    .section-title {
      font-size: 16pt; font-weight: 700; color: #1a1a2e; margin: 0 0 12px 0;
      padding-bottom: 6px; border-bottom: 3px solid #1a1a2e;
    }
    .section-break { page-break-before: always; }

    /* ---- Table Cards ---- */
    .table-card {
      border: 1px solid #dee2e6; border-radius: 8px; margin-bottom: 14px;
      page-break-inside: avoid; overflow: hidden;
    }
    .table-header {
      background: #1a1a2e; color: white; padding: 8px 14px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .table-title { font-weight: 700; font-size: 11pt; }
    .table-title .table-num { font-weight: 400; opacity: 0.7; font-size: 9pt; }
    .table-meta { font-size: 8pt; opacity: 0.7; }
    .guest-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    .guest-table th {
      background: #f8f9fa; text-align: left; padding: 5px 10px;
      font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; color: #666;
      border-bottom: 1px solid #dee2e6;
    }
    .guest-table td { padding: 5px 10px; border-bottom: 1px solid #f0f0f0; }
    .guest-table tr:last-child td { border-bottom: none; }
    .guest-name { font-weight: 600; }
    .guest-company { color: #555; }
    .guest-seat { text-align: center; width: 40px; }
    .guest-dietary { font-size: 8pt; color: #888; }
    .vip-badge {
      display: inline-block; background: #dc3545; color: white; font-size: 6.5pt;
      padding: 1px 5px; border-radius: 3px; font-weight: 700; vertical-align: middle;
    }
    .empty-table { color: #aaa; font-style: italic; text-align: center; padding: 10px; }
    .table-notes { font-size: 8pt; color: #666; padding: 4px 14px 6px; background: #fffde7; border-top: 1px solid #f0f0f0; }

    /* ---- Guest Directory ---- */
    .directory-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 20px; }
    .directory-table th {
      background: #1a1a2e; color: white; text-align: left; padding: 6px 10px;
      font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .directory-table td { padding: 5px 10px; border-bottom: 1px solid #e9ecef; }
    .directory-table tr:nth-child(even) td { background: #f8f9fa; }
    .table-ref { white-space: nowrap; }

    /* ---- Unassigned ---- */
    .unassigned-title { color: #dc3545; border-bottom-color: #dc3545; }
    .unassigned-table th { background: #ffc107; color: #000; }

    /* ---- Footer ---- */
    .page-footer {
      margin-top: 20px; padding-top: 8px; border-top: 1px solid #e9ecef;
      font-size: 7.5pt; color: #aaa; text-align: center;
    }

    /* ---- Print-specific ---- */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
      .table-header { background: #1a1a2e !important; color: white !important; }
      .vip-badge { background: #dc3545 !important; color: white !important; }
      .directory-table th { background: #1a1a2e !important; color: white !important; }
    }

    /* ---- Screen toolbar ---- */
    .print-toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #1a1a2e; color: white; padding: 10px 20px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .print-toolbar button {
      background: #0d6efd; color: white; border: none; padding: 8px 20px;
      border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 10pt;
    }
    .print-toolbar button:hover { background: #0b5ed7; }
    @media print { .print-toolbar { display: none; } }
    .content { margin-top: 56px; padding: 20px; }
    @media print { .content { margin-top: 0; padding: 0; } }
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <div><strong>Table Plan</strong> &mdash; ${esc(eventName)}</div>
    <div>
      <button onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
  <div class="content">
    <!-- Cover Page -->
    <div class="cover">
      <h1>Table Plan</h1>
      <div class="event-name">${esc(eventName)}</div>
      <div class="date">${dateStr}</div>
      <div class="stats-grid">
        <div class="stat-box"><div class="num">${sortedTables.length}</div><div class="label">Tables</div></div>
        <div class="stat-box highlight"><div class="num">${totalSeated}</div><div class="label">Seated</div></div>
        <div class="stat-box"><div class="num">${occupancyPct}%</div><div class="label">Occupancy</div></div>
        <div class="stat-box${this.unassignedGuests.length > 0 ? ' warning' : ''}"><div class="num">${this.unassignedGuests.length}</div><div class="label">Unassigned</div></div>
      </div>
    </div>

    <!-- Table-by-Table Seating -->
    <h2 class="section-title">Seating by Table</h2>
    ${tableCardsHtml}

    <!-- Alphabetical Guest Directory -->
    <div class="section-break"></div>
    <h2 class="section-title">Guest Directory (A&ndash;Z)</h2>
    <table class="directory-table">
      <thead><tr><th>Guest</th><th>Company</th><th>Table</th><th>Seat</th></tr></thead>
      <tbody>${directoryHtml}</tbody>
    </table>

    ${unassignedHtml}

    <div class="page-footer">
      ${esc(eventName)} &mdash; Table Plan &mdash; Generated ${dateStr}
    </div>
  </div>
</body>
</html>`);
    printWindow.document.close();
    utils.showToast('Print document opened — use Print / Save as PDF', 'success');
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

  // ---- RESET CANVAS (remove all tables, fixtures, assignments) ----

  async resetCanvas() {
    const tableCount = this.tables.length;
    const fixtureCount = this.roomFixtures.length;
    const seatedCount = this.tables.reduce((s, t) => s + (t.assignments?.length || 0), 0);
    if (tableCount === 0 && fixtureCount === 0) {
      utils.showToast('Canvas is already empty', 'info');
      return;
    }

    const parts = [];
    if (tableCount > 0) parts.push(`${tableCount} table(s)`);
    if (seatedCount > 0) parts.push(`${seatedCount} seated guest(s)`);
    if (fixtureCount > 0) parts.push(`${fixtureCount} room element(s)`);

    if (!await utils.confirmDialog({
      title: 'Reset Canvas',
      message: `This will remove ${parts.join(', ')} from the canvas. All guest assignments will be cleared.<br><br>This cannot be undone.`,
      confirmText: 'Reset Everything'
    })) return;

    try {
      // Delete all assignments first
      if (seatedCount > 0) {
        const tableIds = this.tables.map(t => t.id);
        const { error: clearErr } = await STATE.client
          .from('table_assignments')
          .delete()
          .in('table_id', tableIds);
        if (clearErr) throw clearErr;
      }

      // Delete all tables
      if (tableCount > 0) {
        const { error: tabErr } = await STATE.client
          .from('event_tables')
          .delete()
          .eq('event_id', this.currentEventIdTablePlan);
        if (tabErr) throw tabErr;
      }

      // Delete all fixtures
      if (fixtureCount > 0) {
        for (const f of this.roomFixtures) {
          try {
            await STATE.client.from('event_room_fixtures').delete().eq('id', f.id);
          } catch (e) { /* continue */ }
        }
        this.roomFixtures = [];
        this._saveFixturesToLocalStorage();
      }

      this._selectedTableId = null;
      this._selectedFixtureId = null;
      this.closeTableDetail();
      utils.showToast('Canvas reset', 'success');
      await this.loadTablePlan();
      this.renderUnassignedGuests();
      this.renderCanvasTables();
      this._updateHeaderBadges();

      // Show setup panel again
      const setup = document.getElementById('tpSetupPanel');
      const guests = document.getElementById('tpGuestsPanel');
      if (setup) setup.style.display = 'block';
      if (guests) guests.style.display = 'none';
    } catch (error) {
      console.error('Error resetting canvas:', error);
      utils.showToast('Failed to reset canvas', 'error');
    }
  },

  // ---- CLEAR TABLE (remove all guests) ----

  async clearTable(tableId) {
    const table = this.tables.find(t => t.id === tableId);
    if (!table || !table.assignments || table.assignments.length === 0) return;

    if (!await utils.confirmDialog({ title: 'Clear Table', message: `Remove all ${table.assignments.length} guest(s) from this table?`, confirmText: 'Clear Table' })) return;

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
      this._updateHeaderBadges();
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
    this.renderEventsCharts();
  },

  renderEventsCharts() {
    const container = document.getElementById('eventsChartsContainer');
    if (!container) return;
    const events = STATE.allEvents || [];

    // Events by status breakdown
    const statusCounts = {};
    events.forEach(e => {
      const s = e.event_status || 'draft';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    // Events by month timeline
    const monthCounts = {};
    events.forEach(e => {
      if (e.event_date) {
        const m = e.event_date.substring(0, 7); // YYYY-MM
        monthCounts[m] = (monthCounts[m] || 0) + 1;
      }
    });

    const statusColors = { draft: '#6c757d', confirmed: '#198754', cancelled: '#dc3545', complete: '#0dcaf0' };

    // Render simple bar charts using CSS
    let html = '<div class="row g-3 mb-3">';

    // Status breakdown
    html += '<div class="col-md-6"><div class="card"><div class="card-body"><h6 class="card-title small fw-semibold">Events by Status</h6>';
    const maxStatus = Math.max(...Object.values(statusCounts), 1);
    Object.entries(statusCounts).forEach(([status, count]) => {
      const pct = (count / maxStatus) * 100;
      html += `<div class="d-flex align-items-center mb-1 small">
        <span class="text-muted" style="width:80px;">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
        <div class="flex-grow-1 mx-2"><div class="progress" style="height:12px;"><div class="progress-bar" style="width:${pct}%;background:${statusColors[status] || '#0d6efd'}"></div></div></div>
        <span class="fw-semibold">${count}</span>
      </div>`;
    });
    html += '</div></div></div>';

    // Monthly timeline
    html += '<div class="col-md-6"><div class="card"><div class="card-body"><h6 class="card-title small fw-semibold">Events by Month</h6>';
    const sortedMonths = Object.entries(monthCounts).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    const maxMonth = Math.max(...sortedMonths.map(m => m[1]), 1);
    sortedMonths.forEach(([month, count]) => {
      const pct = (count / maxMonth) * 100;
      html += `<div class="d-flex align-items-center mb-1 small">
        <span class="text-muted" style="width:60px;">${month.slice(5)}</span>
        <div class="flex-grow-1 mx-2"><div class="progress" style="height:10px;"><div class="progress-bar bg-primary" style="width:${pct}%"></div></div></div>
        <span>${count}</span>
      </div>`;
    });
    html += '</div></div></div></div>';

    container.innerHTML = html;
  },

  filterEvents() {
    this._evtCurrentPage = 1;
    const search = (document.getElementById('eventsSearchBox')?.value || '').toLowerCase().trim();
    const year = document.getElementById('eventsYearFilter')?.value || '';
    const timeStatus = document.getElementById('eventsStatusFilter')?.value || '';
    const eventStatus = document.getElementById('eventsEventStatusFilter')?.value || '';

    try { localStorage.setItem('eventsFilters', JSON.stringify({ search, year, timeStatus, eventStatus })); } catch(e) { console.warn('Failed to save event filters:', e.message); }

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

    // If search query is active and no exact matches found, try fuzzy search
    if (search && filtered.length === 0) {
      filtered = utils.fuzzyFilter(STATE.allEvents || [], search, ['event_name', 'venue', 'description']);
      // Also apply non-search filters to fuzzy results
      if (year) filtered = filtered.filter(e => String(e.year) === year || (e.event_date && e.event_date.startsWith(year)));
      if (timeStatus === 'upcoming') filtered = filtered.filter(e => e.event_date && e.event_date >= today);
      if (timeStatus === 'past') filtered = filtered.filter(e => e.event_date && e.event_date < today);
      if (timeStatus === 'this-month') filtered = filtered.filter(e => e.event_date && e.event_date >= monthStart && e.event_date <= monthEnd);
      if (eventStatus) filtered = filtered.filter(e => (e.event_status || 'draft') === eventStatus);
    }

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
    utils.saveSortState('events', this._sortField, this._sortDir);
    this._updateSortIndicators();
    this.filterEvents();
  },

  _updateSortIndicators() {
    const icons = document.querySelectorAll('[data-sort-icon-events]');
    icons.forEach(icon => {
      const field = icon.getAttribute('data-sort-icon-events');
      if (field === this._sortField) {
        icon.className = this._sortDir === 'asc'
          ? 'bi bi-caret-up-fill text-primary ms-1 small'
          : 'bi bi-caret-down-fill text-primary ms-1 small';
      } else {
        icon.className = 'bi bi-arrow-down-up text-muted ms-1 small';
      }
    });
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

  _evtCurrentPage: 1,
  _evtPageSize: 50,

  _selectedEvents: new Set(),

  renderFilteredEvents(events) {
    const tbody = document.getElementById('eventsTableBody');
    const count = document.getElementById('eventsCount');
    if (!tbody) return;
    if (count) count.textContent = events.length;

    // Pagination
    const totalPages = Math.ceil(events.length / (this._evtPageSize || 50));
    if ((this._evtCurrentPage || 1) > totalPages) this._evtCurrentPage = totalPages || 1;
    const pgStart = ((this._evtCurrentPage || 1) - 1) * (this._evtPageSize || 50);
    const pgEnd = pgStart + (this._evtPageSize || 50);
    const pageEvents = events.slice(pgStart, pgEnd);
    this._lastFilteredEvents = events; // store for page navigation

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
      utils.showEnhancedEmptyState('eventsTableBody', 11, { icon: 'bi-calendar-event', message: 'No events match your filters', description: 'Try adjusting your filters to see more results', isFiltered: true });
      return;
    }

    const statusColors = { draft: 'secondary', confirmed: 'success', cancelled: 'danger', complete: 'info' };
    const statusIcons = { draft: 'bi-pencil', confirmed: 'bi-check-circle', cancelled: 'bi-x-circle', complete: 'bi-flag' };
    const statusOptions = ['draft', 'confirmed', 'cancelled', 'complete'];

    // Pre-load award and attendee counts for all events (async, updates DOM when ready)
    const eventIds = events.map(e => e.id);
    this._loadEventAwardCounts(eventIds);
    this._loadEventAttendeeCounts(eventIds);

    tbody.innerHTML = pageEvents.map(event => {
      // Fix date display to avoid timezone shift + countdown
      let eventDate;
      let countdown = '';
      if (event.event_date) {
        const parts = event.event_date.split('T')[0].split('-');
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        eventDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        // Countdown
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
        if (diff > 0 && diff <= 90) {
          countdown = `<br><span class="badge bg-${diff <= 7 ? 'danger' : diff <= 30 ? 'warning text-dark' : 'info'}" style="font-size:0.6rem;">${diff}d away</span>`;
        } else if (diff === 0) {
          countdown = '<br><span class="badge bg-danger" style="font-size:0.6rem;">TODAY</span>';
        }
      } else {
        eventDate = '<span class="text-danger small">No date</span>';
      }

      const evtStatus = event.event_status || 'draft';
      const color = statusColors[evtStatus] || 'secondary';
      const icon = statusIcons[evtStatus] || 'bi-circle';

      // Clickable status dropdown
      const statusDropdown = `
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false">
            <i class="bi ${icon} me-1"></i>${evtStatus.charAt(0).toUpperCase() + evtStatus.slice(1)}
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            ${statusOptions.map(s => `
              <li><a class="dropdown-item ${s === evtStatus ? 'active' : ''}" href="#" onclick="event.preventDefault(); eventsModule.quickSetStatus('${event.id}', '${s}')">
                <i class="bi ${statusIcons[s]} me-2"></i>${s.charAt(0).toUpperCase() + s.slice(1)}
              </a></li>
            `).join('')}
          </ul>
        </div>`;

      const capacity = event.capacity || 0;
      const checked = this._selectedEvents.has(event.id) ? 'checked' : '';
      const eName = utils.escapeHtml(event.event_name).replace(/'/g, "\\'");

      // Award counts (from cache or placeholder)
      const awardData = this._eventAwardCounts?.[event.id] || { total: 0, confirmed: 0, winners: 0 };

      // Capacity and attendee cells rendered as placeholders; updated async by _loadEventAttendeeCounts
      const capacityCell = '<span class="text-muted small">-</span>';

      return `
        <tr class="fade-in">
          <td><input type="checkbox" class="form-check-input event-checkbox" value="${event.id}" ${checked} onchange="eventsModule.toggleEventSelect('${event.id}', this.checked)"></td>
          <td class="fw-semibold">${utils.escapeHtml(event.event_name)}${!event.venue ? ' <i class="bi bi-exclamation-triangle text-warning small" title="Missing venue"></i>' : ''}</td>
          <td><span class="badge bg-primary">${utils.escapeHtml(String(event.year || '-'))}</span></td>
          <td>${eventDate}${countdown}</td>
          <td>${utils.escapeHtml(event.venue || '-')}</td>
          <td class="text-center" id="capacityCell_${event.id}">${capacityCell}</td>
          <td class="text-center" id="vipCell_${event.id}"><span class="text-muted small">-</span></td>
          <td class="text-center" id="awardCount_${event.id}">${awardData.total > 0 ? `<span class="badge bg-success" title="${awardData.confirmed} confirmed">${awardData.confirmed}/${awardData.total}</span>` : '<span class="text-muted small">-</span>'}</td>
          <td class="text-center" id="winnerCount_${event.id}">${awardData.winners > 0 ? `<span class="badge bg-info">${awardData.winners}</span>` : '<span class="text-muted small">-</span>'}</td>
          <td class="text-center">${statusDropdown}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-warning btn-icon" onclick="eventsModule.openRunningOrderModal('${event.id}', '${eName}')" title="Running Order" aria-label="Running order"><i class="bi bi-list-ol"></i></button>
              <button class="btn btn-outline-secondary btn-icon" onclick="eventsModule.openTablePlanModal('${event.id}', '${eName}')" title="Table Plan" aria-label="Table plan"><i class="bi bi-table"></i></button>
              <button class="btn btn-outline-info btn-icon" onclick="eventsModule.openAttendeesModal('${event.id}')" title="Attendees" aria-label="Attendees"><i class="bi bi-people"></i></button>
              <button class="btn btn-outline-primary btn-icon" onclick="eventsModule.openEditModal('${event.id}')" title="Edit" aria-label="Edit event"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-outline-success btn-icon" onclick="eventsModule.openCloneModal('${event.id}')" title="Clone" aria-label="Clone event"><i class="bi bi-files"></i></button>
              <button class="btn btn-outline-dark btn-icon" onclick="eventsModule.cloneForNextYear('${event.id}')" title="Clone for Next Year" aria-label="Clone for next year"><i class="bi bi-calendar-plus"></i></button>
              <button class="btn btn-outline-danger btn-icon" onclick="eventsModule.deleteEvent('${event.id}', '${eName}')" title="Delete" aria-label="Delete event"><i class="bi bi-trash"></i></button>
            </div>
          </td>
        </tr>`;
    }).join('');

    // Render pagination
    let paginationEl = document.getElementById('eventsPagination');
    if (!paginationEl) {
      paginationEl = document.createElement('div');
      paginationEl.id = 'eventsPagination';
      const tableParent = tbody.closest('.table-responsive') || tbody.parentElement;
      if (tableParent) tableParent.after(paginationEl);
    }
    if (totalPages > 1) {
      const cp = this._evtCurrentPage || 1;
      let html = '<nav><ul class="pagination pagination-sm justify-content-center mt-3">';
      html += `<li class="page-item ${cp <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); eventsModule.goToEventsPage(${cp - 1})">Prev</a></li>`;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= cp - 2 && i <= cp + 2)) {
          html += `<li class="page-item ${i === cp ? 'active' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); eventsModule.goToEventsPage(${i})">${i}</a></li>`;
        } else if (i === cp - 3 || i === cp + 3) {
          html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
      }
      html += `<li class="page-item ${cp >= totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); eventsModule.goToEventsPage(${cp + 1})">Next</a></li>`;
      html += '</ul></nav>';
      html += `<div class="text-center text-muted small">Showing ${pgStart+1}-${Math.min(pgEnd, events.length)} of ${events.length}</div>`;
      paginationEl.innerHTML = html;
    } else if (paginationEl) {
      paginationEl.innerHTML = '';
    }
  },

  goToEventsPage(page) {
    const events = this._lastFilteredEvents || STATE.allEvents || [];
    const totalPages = Math.ceil(events.length / (this._evtPageSize || 50));
    this._evtCurrentPage = Math.max(1, Math.min(page, totalPages));
    this.renderFilteredEvents(events);
  },

  /**
   * Quick inline status change from table row dropdown
   */
  async quickSetStatus(eventId, newStatus) {
    try {
      const { error } = await STATE.client
        .from('events')
        .update({ event_status: newStatus })
        .eq('id', eventId);

      if (error) throw error;

      // Update local state
      const evt = STATE.allEvents.find(e => e.id === eventId);
      if (evt) evt.event_status = newStatus;

      utils.showToast(`Event ${newStatus === 'confirmed' ? 'confirmed' : 'set to ' + newStatus}`, 'success');
      this.filterEvents();
    } catch (err) {
      console.error('Error updating status:', err);
      utils.showToast('Error updating status: ' + err.message, 'error');
    }
  },

  /**
   * Load award/winner counts for events (batch, cached)
   */
  _eventAwardCounts: {},

  async _loadEventAwardCounts(eventIds) {
    if (!eventIds || eventIds.length === 0) return;

    // Only fetch for events we haven't cached yet
    const uncached = eventIds.filter(id => !this._eventAwardCounts[id]);
    if (uncached.length === 0) return;

    try {
      // Batch query instead of N+1 loop
      const { data: allAwards, error } = await STATE.client
        .from('awards')
        .select('id, event_id, winner_confirmed')
        .in('event_id', uncached);

      if (error) {
        console.warn('Error loading award counts:', error);
        return;
      }

      // Group by event_id in memory
      const awardsByEvent = {};
      (allAwards || []).forEach(award => {
        if (!awardsByEvent[award.event_id]) awardsByEvent[award.event_id] = [];
        awardsByEvent[award.event_id].push(award);
      });

      uncached.forEach(eventId => {
        const awards = awardsByEvent[eventId] || [];
        const total = awards.length;
        const confirmed = awards.filter(a => a.winner_confirmed === true).length;
        const winners = confirmed;

        this._eventAwardCounts[eventId] = { total, confirmed, winners };

        const awardCell = document.getElementById(`awardCount_${eventId}`);
        if (awardCell && total > 0) {
          awardCell.innerHTML = `<span class="badge bg-success" title="${confirmed} confirmed">${confirmed}/${total}</span>`;
        }
        const winnerCell = document.getElementById(`winnerCount_${eventId}`);
        if (winnerCell && winners > 0) {
          winnerCell.innerHTML = `<span class="badge bg-info">${winners}</span>`;
        }
      });
    } catch (err) {
      console.warn('Error loading award counts:', err);
    }
  },

  /**
   * Load attendee/VIP counts for events and update DOM (async, fire-and-forget)
   */
  _eventAttendeeCounts: {},

  async _loadEventAttendeeCounts(eventIds) {
    if (!eventIds || eventIds.length === 0) return;
    try {
      for (const eventId of eventIds) {
        if (this._eventAttendeeCounts[eventId]) {
          this._updateAttendeeCell(eventId);
          continue;
        }
        const attendees = await this.getAttendees(eventId);
        const attending = attendees.filter(a => a.status === 'attending').length;
        const vipCount = attendees.filter(a => a.vip || a.isVip || a.ticket_type === 'vip').length;
        this._eventAttendeeCounts[eventId] = { total: attendees.length, attending, vipCount };
        this._updateAttendeeCell(eventId);
      }
    } catch (err) {
      console.warn('Error loading attendee counts:', err);
    }
  },

  _updateAttendeeCell(eventId) {
    const data = this._eventAttendeeCounts[eventId];
    if (!data) return;
    const event = (STATE.allEvents || []).find(e => e.id === eventId);
    const capacity = event?.capacity || 0;

    const capCell = document.getElementById(`capacityCell_${eventId}`);
    if (capCell) {
      if (capacity > 0 && data.total > 0) {
        const pct = Math.round(data.attending / capacity * 100);
        const color = pct >= 95 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : pct >= 50 ? 'bg-info' : 'bg-success';
        capCell.innerHTML = `<div class="text-center" style="min-width:60px;"><div class="fw-semibold" style="font-size:0.8rem;">${data.attending}<span class="text-muted">/${capacity}</span></div><div class="progress mt-1" style="height:4px;"><div class="progress-bar ${color}" style="width:${Math.min(pct, 100)}%"></div></div></div>`;
      } else if (data.total > 0) {
        capCell.innerHTML = `<span class="badge bg-info">${data.attending}</span>`;
      }
    }
    const vipCell = document.getElementById(`vipCell_${eventId}`);
    if (vipCell && data.vipCount > 0) {
      vipCell.innerHTML = `<span class="badge bg-warning text-dark">${data.vipCount}</span>`;
    }
  },

  /**
   * Populate year filter dropdown dynamically from event data
   */
  populateYearFilter() {
    const select = document.getElementById('eventsYearFilter');
    if (!select) return;

    const currentYear = new Date().getFullYear();
    const years = new Set();

    // Add years from events data
    (STATE.allEvents || []).forEach(e => {
      if (e.year) years.add(e.year);
      if (e.event_date) {
        const y = parseInt(e.event_date.split('-')[0]);
        if (y) years.add(y);
      }
    });

    // Always include current and next year
    years.add(currentYear);
    years.add(currentYear + 1);

    const sortedYears = [...years].sort((a, b) => b - a);

    const currentValue = select.value;
    select.innerHTML = '<option value="">All Years</option>' +
      sortedYears.map(y => `<option value="${y}" ${String(y) === currentValue ? 'selected' : ''}>${y}</option>`).join('');
  },

  // ============================================
  // BULK OPERATIONS
  // ============================================
  toggleEventSelect(eventId, checked) {
    if (checked) this._selectedEvents.add(eventId);
    else this._selectedEvents.delete(eventId);
    this._updateBulkBar();
    this.updateBulkBar();
  },

  toggleSelectAll(checked) {
    document.querySelectorAll('.event-checkbox').forEach(cb => {
      cb.checked = checked;
      if (checked) this._selectedEvents.add(cb.value);
      else this._selectedEvents.delete(cb.value);
    });
    this._updateBulkBar();
    this.updateBulkBar();
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
    if (!await utils.confirmDialog({ title: 'Delete Events', message: `Delete ${ids.length} event(s)? This cannot be undone.` })) return;
    try {
      const result = await utils.runBatchOperation(ids, async (id) => {
        const { error } = await STATE.client.from('events').delete().eq('id', id);
        if (error) throw error;
      }, 'Deleting events');
      utils.showToast(`${result.succeeded.length} event(s) deleted`, 'success');
      this.clearEventSelection();
      await this.loadEvents();
    } catch (e) {
      utils.showToast('Error deleting events: ' + e.message, 'error');
    }
  },

  async bulkClone() {
    const ids = Array.from(this._selectedEvents);
    if (ids.length === 0) return;
    if (!await utils.confirmDialog({ title: 'Clone Events', message: `Clone ${ids.length} event(s)?`, confirmText: 'Clone', danger: false })) return;
    try {
      const result = await utils.runBatchOperation(ids, async (id) => {
        const src = STATE.allEvents.find(e => e.id === id);
        if (!src) throw new Error('Event not found');
        const { error } = await STATE.client.from('events').insert([{
          event_name: src.event_name + ' (Copy)',
          event_date: src.event_date,
          year: src.year,
          venue: src.venue,
          description: src.description,
          capacity: src.capacity || null,
          event_status: 'draft'
        }]);
        if (error) throw error;
      }, 'Cloning events');
      utils.showToast(`${result.succeeded.length} event(s) cloned`, 'success');
      this.clearEventSelection();
      await this.loadEvents();
    } catch (e) {
      utils.showToast('Error cloning events: ' + e.message, 'error');
    }
  },

  async bulkSetStatus(status) {
    const ids = Array.from(this._selectedEvents);
    if (ids.length === 0) return;
    await utils.runBatchOperation(ids, async (id) => {
      const { error } = await STATE.client.from('events').update({ event_status: status }).eq('id', id);
      if (error) throw error;
    }, 'Setting event status');
    this.clearEventSelection();
    await this.loadEvents();
  },

  // ============================================
  // ADDITIONAL BULK OPERATIONS (inline bar)
  // ============================================

  updateBulkBar() {
    const bar = document.getElementById('eventsBulkBar');
    const count = document.getElementById('eventsBulkCount');
    if (bar && count) {
      count.textContent = this._selectedEvents.size;
      bar.classList.toggle('d-none', this._selectedEvents.size === 0);
    }
  },

  clearSelection() {
    this._selectedEvents.clear();
    document.querySelectorAll('.event-select-cb').forEach(cb => cb.checked = false);
    document.querySelectorAll('.event-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('selectAllEvents');
    if (selectAll) selectAll.checked = false;
    this.updateBulkBar();
    this._updateBulkBar();
  },

  async bulkDeleteEvents() {
    if (this._selectedEvents.size === 0) return;
    if (!await utils.confirmDialog({ title: 'Delete Events', message: `Delete ${this._selectedEvents.size} selected events? This cannot be undone.` })) return;

    const ids = Array.from(this._selectedEvents);
    await utils.runBatchOperation(ids, async (id) => {
      const { error } = await STATE.client.from('events').delete().eq('id', id);
      if (error) throw error;
    }, 'Deleting events');
    this._selectedEvents.clear();
    this.updateBulkBar();
    this._updateBulkBar();
    await this.loadEvents();
  },

  bulkExportEvents() {
    if (this._selectedEvents.size === 0) return;
    const events = (STATE.allEvents || []).filter(e => this._selectedEvents.has(e.id));
    const headers = ['Event Name', 'Date', 'Venue', 'Status', 'Year'];
    const rows = events.map(e => [
      e.event_name || '', e.event_date || '', e.venue || '', e.event_status || '', e.year || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'events_export.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    utils.showToast(`Exported ${events.length} events`, 'success');
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
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header bg-primary text-white"><h5 class="modal-title"><i class="bi bi-upload me-2"></i>Import Attendees from CSV / Excel</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <div class="mb-3"><label class="form-label fw-semibold">Select Event</label>
            <select class="form-select" id="importAttendeesEventId">
              ${events.map(e => `<option value="${e.id}">${utils.escapeHtml(e.event_name)}</option>`).join('')}
            </select></div>

          <!-- Format Guide -->
          <div class="card bg-light mb-3">
            <div class="card-body py-2">
              <h6 class="mb-2"><i class="bi bi-info-circle me-2"></i>Required File Format</h6>
              <p class="small mb-2">Your CSV or Excel file <strong>must include a header row</strong> as the first row. The system recognises these column headings:</p>
              <div class="table-responsive">
                <table class="table table-sm table-bordered mb-2" style="font-size:0.8rem;">
                  <thead class="table-dark"><tr><th>Column Heading</th><th>Required</th><th>Accepted Values</th><th>Example</th></tr></thead>
                  <tbody>
                    <tr><td><strong>Name</strong></td><td><span class="badge bg-danger">Required</span></td><td>Full name of attendee</td><td>John Smith</td></tr>
                    <tr><td><strong>Email</strong></td><td><span class="badge bg-warning text-dark">Recommended</span></td><td>Valid email address</td><td>john@example.com</td></tr>
                    <tr><td><strong>Status</strong></td><td>Optional</td><td><code>attending</code>, <code>not_attending</code>, <code>maybe</code></td><td>attending</td></tr>
                    <tr><td><strong>Type</strong></td><td>Optional</td><td><code>guest</code>, <code>vip</code>, <code>speaker</code>, <code>sponsor</code>, <code>media</code>, <code>staff</code></td><td>vip</td></tr>
                    <tr><td><strong>Plus Ones</strong></td><td>Optional</td><td>Number (0, 1, 2, etc.)</td><td>1</td></tr>
                    <tr><td><strong>Dietary</strong></td><td>Optional</td><td>Free text (dietary requirements)</td><td>Vegetarian</td></tr>
                    <tr><td><strong>Phone</strong></td><td>Optional</td><td>Phone number</td><td>07700 123456</td></tr>
                    <tr><td><strong>Company</strong></td><td>Optional</td><td>Company / organisation name</td><td>Acme Ltd</td></tr>
                    <tr><td><strong>Notes</strong></td><td>Optional</td><td>Free text</td><td>Needs wheelchair access</td></tr>
                  </tbody>
                </table>
              </div>
              <p class="small mb-1"><strong>Columns can be in any order.</strong> Extra unrecognised columns are ignored. Duplicates (same name + email) are skipped.</p>
              <div class="d-flex gap-2 mt-2">
                <button class="btn btn-sm btn-outline-primary" onclick="eventsModule._downloadImportTemplate('csv')"><i class="bi bi-download me-1"></i>Download CSV Template</button>
                <button class="btn btn-sm btn-outline-success" onclick="eventsModule._downloadImportTemplate('xlsx')"><i class="bi bi-download me-1"></i>Download Excel Template</button>
              </div>
            </div>
          </div>

          <div class="mb-3"><label class="form-label fw-semibold">Upload CSV or Excel File (.csv, .xls, .xlsx)</label>
            <input type="file" class="form-control" id="importAttendeesFile" accept=".csv,.xls,.xlsx">
            <div class="form-text">Supports .csv, .xls and .xlsx files. Maximum 5,000 rows per import.</div></div>

          <div class="mb-3"><label class="form-label fw-semibold">Or paste CSV text directly:</label>
            <textarea class="form-control font-monospace" id="importAttendeesText" rows="5" placeholder="Name,Email,Status,Type,Plus Ones,Dietary&#10;John Smith,john@example.com,attending,vip,1,Vegetarian&#10;Jane Doe,jane@example.com,attending,guest,0,"></textarea></div>

          <div class="form-check mb-2">
            <input class="form-check-input" type="checkbox" id="importSkipDuplicates" checked>
            <label class="form-check-label small" for="importSkipDuplicates">Skip duplicates (same name + email already in attendee list)</label>
          </div>

          <!-- Preview area -->
          <div id="importPreviewArea" style="display:none;" class="mb-3">
            <h6><i class="bi bi-eye me-2"></i>Preview</h6>
            <div class="table-responsive" style="max-height:200px; overflow-y:auto;">
              <table class="table table-sm table-striped" id="importPreviewTable"><thead></thead><tbody></tbody></table>
            </div>
            <small class="text-muted" id="importPreviewCount"></small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-info" onclick="eventsModule._previewImport()"><i class="bi bi-eye me-1"></i>Preview</button>
          <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary" onclick="eventsModule.executeImportAttendees()"><i class="bi bi-upload me-2"></i>Import</button>
        </div>
      </div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('importAttendeesModal')).show();
  },

  _downloadImportTemplate(format) {
    if (format === 'csv') {
      const csv = 'Name,Email,Status,Type,Plus Ones,Dietary,Phone,Company,Notes\nJohn Smith,john@example.com,attending,guest,0,,,Acme Ltd,\nJane Doe,jane@example.com,attending,vip,1,Vegetarian,07700 123456,Widget Co,Needs front row seating\n';
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'attendees_import_template.csv'; a.click(); URL.revokeObjectURL(a.href);
    } else {
      // Generate a simple CSV template labelled as .xlsx for user to open in Excel
      const csv = 'Name,Email,Status,Type,Plus Ones,Dietary,Phone,Company,Notes\nJohn Smith,john@example.com,attending,guest,0,,,Acme Ltd,\nJane Doe,jane@example.com,attending,vip,1,Vegetarian,07700 123456,Widget Co,Needs front row seating\n';
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'attendees_import_template.csv'; a.click(); URL.revokeObjectURL(a.href);
      utils.showToast('Template downloaded as CSV - open in Excel and save as .xlsx if needed', 'info');
    }
  },

  async _parseImportFile() {
    let csvText = document.getElementById('importAttendeesText')?.value?.trim();

    if (!csvText) {
      const file = document.getElementById('importAttendeesFile')?.files[0];
      if (!file) return null;

      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        // Load SheetJS library dynamically for Excel parsing
        if (typeof XLSX === 'undefined') {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Excel parser'));
            document.head.appendChild(script);
          });
        }

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        csvText = XLSX.utils.sheet_to_csv(sheet);
      } else {
        csvText = await file.text();
      }
    }

    if (!csvText) return null;

    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) { utils.showToast('File needs a header row and at least one data row', 'warning'); return null; }
    if (lines.length > 5001) { utils.showToast('Maximum 5,000 rows allowed per import', 'warning'); return null; }

    // Parse header - map columns by name
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const colMap = {};
    const knownHeaders = {
      'name': 'name', 'full name': 'name', 'attendee name': 'name', 'first name': 'name', 'fullname': 'name',
      'email': 'email', 'email address': 'email', 'e-mail': 'email',
      'status': 'status', 'rsvp': 'status', 'rsvp status': 'status', 'attendance': 'status',
      'type': 'guestType', 'guest type': 'guestType', 'category': 'guestType', 'ticket type': 'guestType', 'role': 'guestType',
      'plus ones': 'plusOnes', 'plus-ones': 'plusOnes', 'guests': 'plusOnes', 'additional guests': 'plusOnes', 'plus 1': 'plusOnes', '+1': 'plusOnes',
      'dietary': 'dietary', 'dietary requirements': 'dietary', 'diet': 'dietary', 'food requirements': 'dietary', 'dietary needs': 'dietary',
      'phone': 'phone', 'telephone': 'phone', 'mobile': 'phone', 'phone number': 'phone', 'tel': 'phone',
      'company': 'company', 'organisation': 'company', 'organization': 'company', 'org': 'company', 'company name': 'company',
      'notes': 'notes', 'comments': 'notes', 'note': 'notes', 'additional info': 'notes'
    };

    headers.forEach((h, idx) => {
      if (knownHeaders[h]) colMap[knownHeaders[h]] = idx;
    });

    if (colMap.name === undefined) {
      // Fallback: assume first column is Name, second is Email, third is Status
      colMap.name = 0;
      if (headers.length > 1) colMap.email = 1;
      if (headers.length > 2) colMap.status = 2;
    }

    const validStatuses = ['attending', 'not_attending', 'maybe'];
    const validTypes = ['guest', 'vip', 'speaker', 'sponsor', 'media', 'staff'];

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      // Smart CSV parsing that handles quoted fields with commas
      const cols = [];
      let current = '';
      let inQuotes = false;
      for (const ch of lines[i]) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      cols.push(current.trim());

      const name = cols[colMap.name] || '';
      if (!name) continue;

      const email = colMap.email !== undefined ? (cols[colMap.email] || '') : '';
      const statusRaw = colMap.status !== undefined ? (cols[colMap.status] || '').toLowerCase() : '';
      const status = validStatuses.includes(statusRaw) ? statusRaw : 'attending';
      const typeRaw = colMap.guestType !== undefined ? (cols[colMap.guestType] || '').toLowerCase() : '';
      const guestType = validTypes.includes(typeRaw) ? typeRaw : 'guest';
      const plusOnes = colMap.plusOnes !== undefined ? (parseInt(cols[colMap.plusOnes]) || 0) : 0;
      const dietary = colMap.dietary !== undefined ? (cols[colMap.dietary] || '') : '';
      const phone = colMap.phone !== undefined ? (cols[colMap.phone] || '') : '';
      const company = colMap.company !== undefined ? (cols[colMap.company] || '') : '';
      const notes = colMap.notes !== undefined ? (cols[colMap.notes] || '') : '';

      rows.push({ name, email, status, guestType, plusOnes, dietary, phone, company, notes });
    }

    return rows;
  },

  async _previewImport() {
    const rows = await this._parseImportFile();
    if (!rows || rows.length === 0) { utils.showToast('No valid data found to preview', 'warning'); return; }

    const previewArea = document.getElementById('importPreviewArea');
    const table = document.getElementById('importPreviewTable');
    const countEl = document.getElementById('importPreviewCount');
    if (!previewArea || !table) return;

    const preview = rows.slice(0, 20);
    table.querySelector('thead').innerHTML = '<tr><th>Name</th><th>Email</th><th>Status</th><th>Type</th><th>+1s</th><th>Dietary</th><th>Company</th></tr>';
    table.querySelector('tbody').innerHTML = preview.map(r =>
      `<tr><td>${utils.escapeHtml(r.name)}</td><td>${utils.escapeHtml(r.email)}</td><td><span class="badge bg-${r.status === 'attending' ? 'success' : r.status === 'maybe' ? 'warning' : 'secondary'}">${r.status}</span></td>
       <td>${r.guestType}</td><td>${r.plusOnes}</td><td>${utils.escapeHtml(r.dietary)}</td><td>${utils.escapeHtml(r.company)}</td></tr>`
    ).join('');

    countEl.textContent = `Showing ${preview.length} of ${rows.length} row(s) to import`;
    previewArea.style.display = 'block';
  },

  async executeImportAttendees() {
    const eventId = document.getElementById('importAttendeesEventId')?.value;
    if (!eventId) { utils.showToast('Select an event', 'warning'); return; }

    const rows = await this._parseImportFile();
    if (!rows || rows.length === 0) { utils.showToast('No valid data found. Check your file format matches the template.', 'warning'); return; }

    const existing = await this.getAttendees(eventId) || [];
    const skipDuplicates = document.getElementById('importSkipDuplicates')?.checked !== false;

    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      // Duplicate check
      if (skipDuplicates) {
        const isDupe = existing.some(a =>
          a.name.toLowerCase() === r.name.toLowerCase() &&
          (r.email ? a.email?.toLowerCase() === r.email.toLowerCase() : true)
        );
        if (isDupe) { skipped++; continue; }
      }

      existing.push({
        id: 'attendee_' + Date.now() + '_' + i,
        name: r.name,
        email: r.email,
        status: r.status,
        guestType: r.guestType,
        plusOnes: r.plusOnes,
        dietary: r.dietary,
        phone: r.phone,
        company: r.company,
        notes: r.notes,
        addedAt: new Date().toISOString()
      });
      imported++;
    }

    this.saveAttendees(eventId, existing);
    bootstrap.Modal.getInstance(document.getElementById('importAttendeesModal'))?.hide();

    let msg = `Imported ${imported} attendee(s)`;
    if (skipped > 0) msg += `, ${skipped} duplicate(s) skipped`;
    utils.showToast(msg, 'success');

    // If attendees modal is open, refresh it
    const attendeesModal = document.getElementById('attendeesModal');
    if (attendeesModal && attendeesModal.classList.contains('show')) {
      this.renderAttendees(eventId);
    }
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

  // ============================================
  // FINANCIAL OVERVIEW - ALL EVENTS
  // ============================================
  renderFinancialOverview() {
    const events = STATE.allEvents || [];
    if (events.length === 0) return;

    const rows = [];
    let grandRevenue = 0, grandBudget = 0, grandCosts = 0;

    events.forEach(e => {
      const cachedAttendees = this._eventAttendeeCounts[e.id];
      const attending = cachedAttendees ? cachedAttendees.attending : 0;
      const price = parseFloat(e.ticket_price) || 0;
      const revenue = price * attending;

      const budget = this.getBudget(e.id);
      const totalBudget = parseFloat(budget.totalBudget) || 0;
      const actualCosts = budget.items ? budget.items.reduce((s, i) => s + (parseFloat(i.actual) || 0), 0) : 0;
      const netPL = revenue - actualCosts;

      grandRevenue += revenue;
      grandBudget += totalBudget;
      grandCosts += actualCosts;

      rows.push({ event: e, revenue, totalBudget, actualCosts, netPL });
    });

    const grandNet = grandRevenue - grandCosts;
    const margin = grandRevenue > 0 ? Math.round(grandNet / grandRevenue * 100) : 0;

    // Update summary cards
    const revEl = document.getElementById('financialTotalRevenue');
    const costEl = document.getElementById('financialTotalCosts');
    const netEl = document.getElementById('financialNetPL');
    const marginEl = document.getElementById('financialMargin');

    if (revEl) revEl.textContent = `\u00A3${grandRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
    if (costEl) costEl.textContent = `\u00A3${grandCosts.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
    if (netEl) {
      netEl.textContent = `${grandNet >= 0 ? '' : '-'}\u00A3${Math.abs(grandNet).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
      netEl.className = `mb-0 ${grandNet >= 0 ? 'text-success' : 'text-danger'} fw-bold`;
    }
    if (marginEl) {
      if (grandRevenue > 0) {
        marginEl.textContent = `${margin}%`;
        marginEl.className = `mb-0 ${margin >= 0 ? 'text-success' : 'text-danger'} fw-bold`;
      } else {
        marginEl.textContent = '-';
        marginEl.className = 'mb-0 text-muted';
      }
    }

    // Render per-event breakdown table
    const tbody = document.getElementById('financialBreakdownBody');
    const tfoot = document.getElementById('financialBreakdownFoot');
    if (tbody) {
      const statusColors = { draft: 'secondary', confirmed: 'success', cancelled: 'danger', complete: 'info' };
      tbody.innerHTML = rows.map(r => {
        const color = statusColors[r.event.event_status || 'draft'] || 'secondary';
        return `<tr>
          <td class="fw-semibold">${utils.escapeHtml(r.event.event_name)}</td>
          <td>${r.event.year || '-'}</td>
          <td class="text-end ${r.revenue > 0 ? 'text-success' : ''}">${r.revenue > 0 ? '\u00A3' + r.revenue.toFixed(2) : '-'}</td>
          <td class="text-end">${r.totalBudget > 0 ? '\u00A3' + r.totalBudget.toFixed(2) : '-'}</td>
          <td class="text-end ${r.actualCosts > 0 ? 'text-danger' : ''}">${r.actualCosts > 0 ? '\u00A3' + r.actualCosts.toFixed(2) : '-'}</td>
          <td class="text-end fw-bold ${r.netPL >= 0 ? 'text-success' : 'text-danger'}">${r.revenue > 0 || r.actualCosts > 0 ? (r.netPL >= 0 ? '' : '-') + '\u00A3' + Math.abs(r.netPL).toFixed(2) : '-'}</td>
          <td class="text-center"><span class="badge bg-${color}">${(r.event.event_status || 'draft')}</span></td>
        </tr>`;
      }).join('');
    }
    if (tfoot) {
      tfoot.innerHTML = `<tr>
        <td colspan="2" class="fw-bold">TOTALS</td>
        <td class="text-end fw-bold">\u00A3${grandRevenue.toFixed(2)}</td>
        <td class="text-end fw-bold">\u00A3${grandBudget.toFixed(2)}</td>
        <td class="text-end fw-bold">\u00A3${grandCosts.toFixed(2)}</td>
        <td class="text-end fw-bold ${grandNet >= 0 ? 'text-success' : 'text-danger'}">${grandNet >= 0 ? '' : '-'}\u00A3${Math.abs(grandNet).toFixed(2)}</td>
        <td></td>
      </tr>`;
    }
  },

  exportFinancialSummary() {
    const events = STATE.allEvents || [];
    if (events.length === 0) { utils.showToast('No events', 'warning'); return; }

    const csvRows = events.map(e => {
      const cachedAttendees = this._eventAttendeeCounts[e.id];
      const attending = cachedAttendees ? cachedAttendees.attending : 0;
      const revenue = (parseFloat(e.ticket_price) || 0) * attending;
      const budget = this.getBudget(e.id);
      const totalBudget = parseFloat(budget.totalBudget) || 0;
      const actualCosts = budget.items ? budget.items.reduce((s, i) => s + (parseFloat(i.actual) || 0), 0) : 0;

      return {
        'Event': e.event_name || '',
        'Year': e.year || '',
        'Date': e.event_date || '',
        'Status': e.event_status || 'draft',
        'Ticket Price': e.ticket_price || 0,
        'Attending': attending,
        'Ticket Revenue': revenue,
        'Total Budget': totalBudget,
        'Actual Costs': actualCosts,
        'Net P&L': revenue - actualCosts,
        'Budget Remaining': totalBudget - actualCosts
      };
    });

    utils.exportToCSV(csvRows, `financial_summary_all_events_${new Date().toISOString().split('T')[0]}.csv`);
    utils.showToast('Financial summary exported', 'success');
  },

  exportEventsCSV() {
    const events = STATE.allEvents || [];
    if (events.length === 0) { utils.showToast('No events to export', 'warning'); return; }
    const rows = [['Event Name', 'Year', 'Date', 'Venue', 'Status', 'Description', 'Attendees']];
    events.forEach(e => {
      const cachedAttendees = this._eventAttendeeCounts[e.id];
      rows.push([e.event_name || '', e.year || '', e.event_date || '', e.venue || '', e.event_status || 'draft', e.description || '', cachedAttendees ? cachedAttendees.total : 0]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `events_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    utils.showToast('Events exported', 'success');
  },

  /**
   * Export events to Excel format
   */
  exportEventsExcel() {
    const events = STATE.allEvents || [];
    if (events.length === 0) { utils.showToast('No events to export', 'warning'); return; }
    const exportData = events.map(e => {
      const cachedAttendees = this._eventAttendeeCounts[e.id];
      return {
        event_name: e.event_name || '',
        year: e.year || '',
        date: e.event_date || '',
        venue: e.venue || '',
        status: e.event_status || 'draft',
        description: e.description || '',
        attendees: cachedAttendees ? cachedAttendees.total : 0
      };
    });
    utils.exportToExcel(exportData, `events_export_${new Date().toISOString().split('T')[0]}`);
  },

  /**
   * Export events to printable PDF
   */
  exportEventsPDF() {
    const events = STATE.allEvents || [];
    if (events.length === 0) { utils.showToast('No events to export', 'warning'); return; }
    const exportData = events.map(e => {
      const cachedAttendees = this._eventAttendeeCounts[e.id];
      return {
        event_name: e.event_name || '',
        year: e.year || '',
        date: e.event_date || '',
        venue: e.venue || '',
        status: e.event_status || 'draft',
        attendees: cachedAttendees ? cachedAttendees.total : 0
      };
    });
    utils.exportToPrintablePDF(exportData, 'Events Report', { columns: ['event_name', 'year', 'date', 'venue', 'status', 'attendees'] });
  },

  // ============================================
  // CALENDAR VIEW
  // ============================================
  toggleEventsCalendar() {
    const cal = document.getElementById('eventsCalendarView');
    if (cal.style.display === 'none' || !cal.style.display) {
      cal.style.display = 'block';
      this.renderCalendar();
    } else {
      cal.style.display = 'none';
    }
  },

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
  },

  // ============================================
  // EVENT MILESTONES / CHECKLIST
  // ============================================
  _milestonesKey(eventId) {
    return `bta_milestones_${eventId}`;
  },

  _getDefaultMilestones() {
    return [
      { id: 'm1', label: 'Venue booked', done: false, category: 'Planning' },
      { id: 'm2', label: 'Date confirmed', done: false, category: 'Planning' },
      { id: 'm3', label: 'Budget set', done: false, category: 'Planning' },
      { id: 'm4', label: 'Catering arranged', done: false, category: 'Logistics' },
      { id: 'm5', label: 'AV/Production booked', done: false, category: 'Logistics' },
      { id: 'm6', label: 'Invitations sent', done: false, category: 'Marketing' },
      { id: 'm7', label: 'Sponsors confirmed', done: false, category: 'Marketing' },
      { id: 'm8', label: 'Awards shortlist finalised', done: false, category: 'Awards' },
      { id: 'm9', label: 'Winners confirmed', done: false, category: 'Awards' },
      { id: 'm10', label: 'Running order set', done: false, category: 'Day of Event' },
      { id: 'm11', label: 'Table plan done', done: false, category: 'Day of Event' },
      { id: 'm12', label: 'Name badges printed', done: false, category: 'Day of Event' },
      { id: 'm13', label: 'Post-event survey created', done: false, category: 'Post-Event' },
      { id: 'm14', label: 'Thank you emails sent', done: false, category: 'Post-Event' }
    ];
  },

  async getMilestones(eventId) {
    try {
      const { data, error } = await STATE.client
        .from('event_milestones')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data && data.length > 0) ? data.map(m => ({
        id: m.id, label: m.label, done: m.done, category: m.category,
        custom: m.custom || false, completedAt: m.completed_at
      })) : this._getDefaultMilestones();
    } catch (e) {
      const stored = localStorage.getItem(this._milestonesKey(eventId));
      return stored ? JSON.parse(stored) : this._getDefaultMilestones();
    }
  },

  async _saveMilestones(eventId, milestones) {
    try {
      await STATE.client.from('event_milestones').delete().eq('event_id', eventId);
      if (milestones.length > 0) {
        const rows = milestones.map(m => ({
          event_id: eventId, milestone_id: m.id, label: m.label,
          done: m.done, category: m.category, custom: m.custom || false,
          completed_at: m.completedAt || null
        }));
        const { error } = await STATE.client.from('event_milestones').insert(rows);
        if (error) throw error;
      }
    } catch (e) {
      localStorage.setItem(this._milestonesKey(eventId), JSON.stringify(milestones));
    }
  },

  async toggleMilestone(eventId, milestoneId) {
    const milestones = await this.getMilestones(eventId);
    const ms = milestones.find(m => m.id === milestoneId);
    if (ms) {
      ms.done = !ms.done;
      ms.completedAt = ms.done ? new Date().toISOString() : null;
    }
    await this._saveMilestones(eventId, milestones);
    this.renderMilestonesPanel(eventId);
  },

  async addCustomMilestone(eventId) {
    const input = document.getElementById('newMilestoneInput');
    const label = input?.value?.trim();
    if (!label) { utils.showToast('Enter a milestone name', 'warning'); return; }
    const milestones = await this.getMilestones(eventId);
    milestones.push({ id: 'mc_' + Date.now(), label, done: false, category: 'Custom', custom: true });
    await this._saveMilestones(eventId, milestones);
    input.value = '';
    this.renderMilestonesPanel(eventId);
  },

  async removeCustomMilestone(eventId, milestoneId) {
    const milestones = (await this.getMilestones(eventId)).filter(m => m.id !== milestoneId);
    await this._saveMilestones(eventId, milestones);
    this.renderMilestonesPanel(eventId);
  },

  async renderMilestonesPanel(eventId) {
    const container = document.getElementById('milestonesContent');
    if (!container) return;
    const milestones = await this.getMilestones(eventId);
    const done = milestones.filter(m => m.done).length;
    const total = milestones.length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;

    const categories = [...new Set(milestones.map(m => m.category))];

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div>
          <strong>${done}/${total}</strong> complete <span class="badge bg-${pct === 100 ? 'success' : pct >= 50 ? 'info' : 'warning'}">${pct}%</span>
        </div>
      </div>
      <div class="progress mb-3" style="height:6px;">
        <div class="progress-bar bg-success" style="width:${pct}%"></div>
      </div>
      ${categories.map(cat => `
        <h6 class="small text-muted mb-1 mt-2">${cat}</h6>
        ${milestones.filter(m => m.category === cat).map(m => `
          <div class="form-check d-flex align-items-center mb-1">
            <input class="form-check-input me-2" type="checkbox" ${m.done ? 'checked' : ''}
              onchange="eventsModule.toggleMilestone('${eventId}', '${m.id}')" id="ms_${m.id}">
            <label class="form-check-label small ${m.done ? 'text-decoration-line-through text-muted' : ''}" for="ms_${m.id}">
              ${utils.escapeHtml(m.label)}
              ${m.completedAt ? `<span class="text-success ms-1" style="font-size:0.65rem;">${new Date(m.completedAt).toLocaleDateString('en-GB')}</span>` : ''}
            </label>
            ${m.custom ? `<button class="btn btn-sm ms-auto p-0 text-danger" onclick="eventsModule.removeCustomMilestone('${eventId}', '${m.id}')" title="Remove"><i class="bi bi-x"></i></button>` : ''}
          </div>
        `).join('')}
      `).join('')}
      <div class="input-group input-group-sm mt-3">
        <input type="text" class="form-control" id="newMilestoneInput" placeholder="Add custom milestone...">
        <button class="btn btn-outline-primary" onclick="eventsModule.addCustomMilestone('${eventId}')"><i class="bi bi-plus"></i></button>
      </div>`;
  },

  // ============================================
  // CLONE EVENT FOR NEXT YEAR
  // ============================================
  async cloneForNextYear(eventId) {
    const src = STATE.allEvents.find(e => e.id === eventId);
    if (!src) return;
    if (!await utils.confirmDialog({ title: 'Clone Event', message: `Clone "${src.event_name}" for next year?`, confirmText: 'Clone', danger: false })) return;

    const nextYear = (parseInt(src.year) || new Date().getFullYear()) + 1;
    let nextDate = null;
    if (src.event_date) {
      const parts = src.event_date.split('T')[0].split('-');
      nextDate = `${nextYear}-${parts[1]}-${parts[2]}`;
    }

    try {
      const { data, error } = await STATE.client.from('events').insert([{
        event_name: src.event_name.replace(/\d{4}/, nextYear) !== src.event_name
          ? src.event_name.replace(/\d{4}/, nextYear)
          : src.event_name + ` ${nextYear}`,
        event_date: nextDate,
        year: nextYear,
        venue: src.venue,
        description: src.description,
        capacity: src.capacity || null,
        ticket_price: src.ticket_price || null,
        event_status: 'draft'
      }]).select();

      if (error) throw error;

      // Copy budget template
      const budget = this.getBudget(eventId);
      if (budget.items && budget.items.length > 0 && data && data[0]) {
        const newBudget = {
          totalBudget: budget.totalBudget,
          items: budget.items.map(i => ({ ...i, actual: 0, status: 'Pending' }))
        };
        this._saveBudget(data[0].id, newBudget);
      }

      // Copy vendors template
      const vendors = this.getVendors(eventId);
      if (vendors.length > 0 && data && data[0]) {
        const newVendors = vendors.map(v => ({ ...v, status: 'Pending', cost: '' }));
        this._saveVendors(data[0].id, newVendors);
      }

      utils.showToast(`Event cloned for ${nextYear}`, 'success');
      await this.loadEvents();
    } catch (err) {
      utils.showToast('Error cloning event: ' + err.message, 'error');
    }
  },

  // ============================================
  // EVENT NOTES / QUICK MEMO
  // ============================================
  async _getEventNotes(eventId) {
    try {
      const { data, error } = await STATE.client
        .from('events')
        .select('notes')
        .eq('id', eventId)
        .single();
      if (error) throw error;
      return data?.notes || '';
    } catch (e) {
      return localStorage.getItem(`bta_event_notes_${eventId}`) || '';
    }
  },

  async _saveEventNotes(eventId) {
    const notes = document.getElementById('eventQuickNotes')?.value || '';
    try {
      const { error } = await STATE.client
        .from('events')
        .update({ notes })
        .eq('id', eventId);
      if (error) throw error;
    } catch (e) {
      localStorage.setItem(`bta_event_notes_${eventId}`, notes);
    }
    utils.showToast('Notes saved', 'success');
  },

  importEventsCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { utils.showToast('CSV file is empty', 'warning'); return; }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const records = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
        const record = {};
        headers.forEach((h, idx) => {
          if (h.includes('name') || h === 'event_name') record.event_name = values[idx];
          else if (h.includes('date') || h === 'event_date') record.event_date = values[idx];
          else if (h === 'year') record.year = parseInt(values[idx]) || null;
          else if (h.includes('venue')) record.venue = values[idx];
          else if (h.includes('capacity')) record.capacity = parseInt(values[idx]) || null;
          else if (h.includes('status') || h === 'event_status') record.event_status = values[idx] || 'draft';
          else if (h.includes('description')) record.description = values[idx];
        });
        if (record.event_name) records.push(record);
      }

      if (records.length === 0) { utils.showToast('No valid records in CSV', 'warning'); return; }
      if (!await utils.confirmDialog({ title: 'Import Events', message: `Import ${records.length} events from CSV?`, confirmText: 'Import', danger: false })) return;

      try {
        utils.showLoading();
        let imported = 0;
        for (const record of records) {
          const { error } = await STATE.client.from('events').insert([record]);
          if (!error) imported++;
          if (utils.showBulkProgress) utils.showBulkProgress(imported, records.length, 'Importing events');
        }
        utils.showToast(`Imported ${imported} of ${records.length} events`, 'success');
        await this.loadEvents();
      } catch (err) {
        utils.showToast('Import error: ' + err.message, 'error');
      } finally {
        utils.hideLoading();
      }
    };
    input.click();
  }
};

// Export to window for global access
window.eventsModule = eventsModule;

// Initialize seating enhancements (seat-level assignment, VIP, dietary, place cards, undo/redo)
if (window.seatingEnhancements) window.seatingEnhancements.init();
