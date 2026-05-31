/* eslint-disable no-unused-vars */
/* company-profile.html extracted scripts — SA2-C1 CSP inline-script fix */

const { getAuthToken, proxyFetch, escapeHtml, escapeAttr, showPublicToast } = window.publicUtils;
const supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

let currentCompany = null;
let currentCompanyId = null;

async function loadCompanyProfile() {
  currentCompanyId = sessionStorage.getItem('selectedCompanyId');
  const companyName = sessionStorage.getItem('selectedCompanyName');

  if (!currentCompanyId) {
    document.getElementById('companyTitle').textContent = 'Company not found';
    return;
  }

  document.getElementById('companyTitle').textContent = companyName;

  const result = await proxyFetch({
    table: 'organisations',
    operation: 'select',
    select: '*',
    filters: { id: currentCompanyId },
    pageSize: 1,
  });
  const data = result.data && result.data.length > 0 ? result.data[0] : null;

  if (data) {
    currentCompany = data;
    displayCompanyInfo();
    populateEditForm();
    displayPrimaryContact();
    loadNominations();
    loadContacts();
    loadDeals();
  }
}

function displayCompanyInfo() {
  if (!currentCompany) return;

  const html = `
    <p><strong>Company Name:</strong> ${escapeHtml(currentCompany.company_name) || 'N/A'}</p>
    <p><strong>Email:</strong> ${escapeHtml(currentCompany.email) || 'N/A'}</p>
    <p><strong>Website:</strong> <a href="${escapeAttr(currentCompany.website)}" target="_blank">${escapeHtml(currentCompany.website) || 'N/A'}</a></p>
    <p><strong>Address:</strong> ${escapeHtml(currentCompany.address) || 'N/A'}</p>
    <p><strong>Region:</strong> ${escapeHtml(currentCompany.region) || 'N/A'}</p>
    <p><strong>Award Name:</strong> ${escapeHtml(currentCompany.award_name) || 'N/A'}</p>
    <p><strong>Notes:</strong> ${escapeHtml(currentCompany.notes) || 'N/A'}</p>
  `;
  document.getElementById('companyInfo').innerHTML = html;
}

function populateEditForm() {
  if (!currentCompany) return;

  document.getElementById('editCompanyName').value = currentCompany.company_name || '';
  document.getElementById('editEmail').value = currentCompany.email || '';
  document.getElementById('editWebsite').value = currentCompany.website || '';
  document.getElementById('editAddress').value = currentCompany.address || '';
  document.getElementById('editRegion').value = currentCompany.region || '';
  document.getElementById('editNotes').value = currentCompany.notes || '';
}

async function saveCompanyInfo() {
  const updatedData = {
    company_name: document.getElementById('editCompanyName').value,
    email: document.getElementById('editEmail').value,
    website: document.getElementById('editWebsite').value,
    address: document.getElementById('editAddress').value,
    region: document.getElementById('editRegion').value,
    notes: document.getElementById('editNotes').value,
  };

  try {
    await proxyFetch({
      table: 'organisations',
      operation: 'update',
      id: currentCompanyId,
      data: updatedData,
    });
    showPublicToast('Changes saved successfully!', 'success');
    currentCompany = { ...currentCompany, ...updatedData };
    displayCompanyInfo();
  } catch (e) {
    showPublicToast('Error saving changes: ' + e.message, 'error');
  }
}

async function loadNominations() {
  if (!currentCompany.award_name) {
    document.getElementById('nominationsContent').innerHTML =
      '<tr><td colspan="6" class="text-center text-muted">No nominations found</td></tr>';
    return;
  }

  try {
    const result = await proxyFetch({
      table: 'awards',
      operation: 'select',
      select: '*',
      filters: { award_name: currentCompany.award_name },
      pageSize: 1000,
    });
    const data = result.data || [];

    if (data.length > 0) {
      const tbody = document.getElementById('nominationsContent');
      tbody.innerHTML = data
        .map((award) => {
          const escapedId = escapeAttr(award.id);
          const escapedName = escapeAttr(award.award_name);
          return `
        <tr>
          <td><a href="#" data-action="viewCompaniesInAward" data-id="${escapedName}" class="text-decoration-none">${escapeHtml(award.award_name)}</a></td>
          <td>${escapeHtml(award.year)}</td>
          <td>${escapeHtml(award.sector)}</td>
          <td>${escapeHtml(award.region)}</td>
          <td>
            ${
              award.winner === currentCompany.company_name
                ? '<span class="badge bg-success">WINNER</span>'
                : '<span class="badge bg-info">NOMINEE</span>'
            }
          </td>
          <td>
            <a href="#" data-action="viewNominees" data-args='["${escapedId}","${escapedName}"]' class="btn btn-sm btn-link p-0">
              <i class="bi bi-eye"></i>
            </a>
          </td>
        </tr>
      `;
        })
        .join('');
    } else {
      document.getElementById('nominationsContent').innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">No nominations found for this award</td></tr>';
    }
  } catch (e) {
    document.getElementById('nominationsContent').innerHTML =
      '<tr><td colspan="6" class="text-center text-muted">No nominations found for this award</td></tr>';
  }
}

function viewCompaniesInAward(awardName) {
  sessionStorage.setItem('selectedAwardName', awardName);
  window.location.href = 'award-nominees.html';
}

function viewNominees(awardId, awardName) {
  sessionStorage.setItem('selectedAwardId', awardId);
  sessionStorage.setItem('selectedAwardName', awardName);
  window.location.href = 'award-nominees.html';
}

async function displayPrimaryContact() {
  if (!currentCompany) return;

  document.getElementById('primaryEmail').textContent = currentCompany.email || 'Not provided';
  document.getElementById('primaryEmail').href = `mailto:${currentCompany.email}`;

  document.getElementById('primaryWebsite').textContent = currentCompany.website || 'Not provided';
  document.getElementById('primaryWebsite').href = currentCompany.website;

  document.getElementById('primaryAddress').textContent = currentCompany.address || 'Not provided';
}

async function loadContacts() {
  try {
    const result = await proxyFetch({
      table: 'contacts',
      operation: 'select',
      select: '*',
      filters: { organisation_id: currentCompanyId },
      sort: { column: 'created_at', ascending: false },
      pageSize: 1000,
    });
    const data = result.data || [];

    if (data.length > 0) {
      const html = data
        .map(
          (contact) => `
        <div class="mb-3 p-3 border rounded bg-light">
          <div class="row">
            <div class="col-md-6">
              <p class="mb-1"><strong>${escapeHtml(contact.name)}</strong></p>
              <p class="mb-1 text-muted">${escapeHtml(contact.title) || 'No title specified'}</p>
              <p class="mb-1">
                <i class="bi bi-envelope"></i>
                <a href="mailto:${escapeAttr(contact.email)}">${escapeHtml(contact.email)}</a>
              </p>
              ${contact.phone ? `<p class="mb-1"><i class="bi bi-telephone"></i> <a href="tel:${escapeAttr(contact.phone)}">${escapeHtml(contact.phone)}</a></p>` : ''}
            </div>
            <div class="col-md-6">
              ${contact.notes ? `<p class="mb-1"><strong>Notes:</strong> ${escapeHtml(contact.notes)}</p>` : ''}
              <button type="button" class="btn btn-sm btn-danger mt-2" data-action="deleteContact" data-id="${escapeAttr(contact.id)}">Delete</button>
            </div>
          </div>
        </div>
      `
        )
        .join('');
      document.getElementById('contactContent').innerHTML = html;
    } else {
      document.getElementById('contactContent').innerHTML =
        '<p class="text-muted">No additional contacts added yet</p>';
    }
  } catch (e) {
    document.getElementById('contactContent').innerHTML = '<p class="text-muted">No additional contacts added yet</p>';
  }
}

async function addContact() {
  const name = document.getElementById('contactName').value;
  const title = document.getElementById('contactTitle').value;
  const email = document.getElementById('contactEmail').value;
  const phone = document.getElementById('contactPhone').value;
  const notes = document.getElementById('contactNotes').value;

  if (!name || !email) {
    showPublicToast('Please fill in Name and Email fields', 'warning');
    return;
  }

  try {
    await proxyFetch({
      table: 'contacts',
      operation: 'insert',
      data: { organisation_id: currentCompanyId, name, title, email, phone, notes },
    });
    showPublicToast('Contact added successfully!', 'success');
    document.getElementById('addContactForm').reset();
    await loadContacts();
  } catch (e) {
    showPublicToast('Error adding contact: ' + e.message, 'error');
  }
}

async function deleteContact(contactId) {
  if (confirm('Are you sure you want to delete this contact?')) {
    try {
      await proxyFetch({ table: 'contacts', operation: 'delete', id: contactId });
      showPublicToast('Contact deleted', 'success');
      await loadContacts();
    } catch (e) {
      showPublicToast('Error deleting contact: ' + e.message, 'error');
    }
  }
}

async function loadDeals() {
  try {
    const result = await proxyFetch({
      table: 'deals',
      operation: 'select',
      select: '*',
      filters: { organisation_id: currentCompanyId },
      pageSize: 1000,
    });
    const data = result.data || [];

    if (data.length > 0) {
      const html = data
        .map(
          (deal) => `
        <div class="mb-2 p-2 border rounded">
          <strong>${escapeHtml(deal.deal_name)}</strong><br>
          Value: £${escapeHtml(String(deal.value))}<br>
          Status: ${escapeHtml(deal.status)}
        </div>
      `
        )
        .join('');
      document.getElementById('dealsContent').innerHTML = html;
    } else {
      document.getElementById('dealsContent').innerHTML = '<p>No deals found</p>';
    }
  } catch (e) {
    document.getElementById('dealsContent').innerHTML = '<p>No deals found</p>';
  }
}

async function uploadFile() {
  const fileInput = document.getElementById('fileUpload');
  if (!fileInput.files.length) {
    showPublicToast('Please select a file', 'warning');
    return;
  }

  const file = fileInput.files[0];
  const filePath = `uploads/${currentCompanyId}/${file.name}`;

  const { error } = await supabaseClient.storage.from('uploads').upload(filePath, file);

  if (error) {
    showPublicToast('Error uploading file: ' + error.message, 'error');
  } else {
    showPublicToast('File uploaded successfully!', 'success');
    fileInput.value = '';
  }
}

function goBack() {
  window.history.back();
}

document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  const parts = el.dataset.action.split('.');
  let ctx = window,
    fn = window;
  for (let i = 0; i < parts.length; i++) {
    ctx = fn;
    fn = fn[parts[i]];
    if (!fn) return;
  }
  if (typeof fn !== 'function') return;
  let args = [];
  if (el.dataset.args) {
    try {
      args = JSON.parse(el.dataset.args);
    } catch (_e) {
      return;
    }
  }
  fn.apply(ctx, args);
});

loadCompanyProfile();
