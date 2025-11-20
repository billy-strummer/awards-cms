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
      } else {
        // Insert new event
        ({ error } = await STATE.client
          .from('events')
          .insert([eventData]));
      }

      if (error) throw error;

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
  }
};

// Export to window for global access
window.eventsModule = eventsModule;
