/* award-nominees.html extracted scripts — SA2-C1 CSP inline-script fix */

const { getAuthToken, proxyFetch, escapeHtml, escapeAttr } = window.publicUtils;

let currentAward = null;

async function checkAuth() {
  const token = await getAuthToken();
  if (!token) {
    document.getElementById('authWarning').style.display = '';
    document.getElementById('nomineesContainer').innerHTML =
      '<tr><td colspan="5" class="text-center text-muted">Please log in to view nominees.</td></tr>';
    return false;
  }
  return true;
}

function goBack() {
  window.history.back();
}

function openCompanyProfile(companyId, companyName) {
  sessionStorage.setItem('selectedCompanyId', companyId);
  sessionStorage.setItem('selectedCompanyName', companyName);
  window.location.href = 'company-profile.html';
}

async function loadPage() {
  const authed = await checkAuth();
  if (!authed) {
    document.getElementById('authWarning').style.display = '';
    document.getElementById('awardTitle').textContent = '';
    return;
  }

  const awardName = sessionStorage.getItem('selectedAwardName');

  if (!awardName) {
    document.getElementById('awardTitle').textContent = 'Award not found';
    return;
  }

  document.getElementById('awardTitle').textContent = awardName;

  try {
    const awardsResult = await proxyFetch({
      table: 'awards',
      operation: 'select',
      select: 'id,award_name,year,region,sector,winner',
      filters: { award_name: awardName },
      pageSize: 1,
    });
    const awards = awardsResult.data || [];
    if (awards.length > 0) {
      currentAward = awards[0];
      const details = `Year: ${currentAward.year || 'N/A'} | Region: ${currentAward.region || 'N/A'} | Sector: ${currentAward.sector || 'N/A'}`;
      document.getElementById('awardDetails').textContent = details;
    }

    const orgsResult = await proxyFetch({
      table: 'organisations',
      operation: 'select',
      select: 'id,company_name,website,region,award_name',
      filters: { award_name: awardName },
      pageSize: 1000,
    });
    const orgs = orgsResult.data || [];

    if (orgs.length === 0) {
      document.getElementById('nomineesContainer').innerHTML =
        '<tr><td colspan="5" class="text-center text-muted">No companies found</td></tr>';
      return;
    }

    let html = '';
    orgs.forEach((org) => {
      const isWinner = currentAward && currentAward.winner === org.company_name;
      const status = isWinner
        ? '<span class="badge bg-success">WINNER</span>'
        : '<span class="badge bg-info">NOMINEE</span>';

      html += `
        <tr>
          <td><a class="company-link" data-action="openCompanyProfile" data-args='["${escapeAttr(org.id)}","${escapeAttr(org.company_name)}"]'>${escapeHtml(org.company_name)}</a></td>
          <td><a href="${escapeAttr(org.website)}" target="_blank">${escapeHtml(org.website) || 'N/A'}</a></td>
          <td>${escapeHtml(org.region) || 'N/A'}</td>
          <td>${status}</td>
          <td><button data-action="openCompanyProfile" data-args='["${escapeAttr(org.id)}","${escapeAttr(org.company_name)}"]' class="btn btn-sm btn-link p-0"><i class="bi bi-eye"></i></button></td>
        </tr>
      `;
    });

    document.getElementById('nomineesContainer').innerHTML = html;
  } catch (err) {
    console.error('Error:', err);
    document.getElementById('nomineesContainer').innerHTML =
      '<tr><td colspan="5" class="text-center text-danger">Error loading page</td></tr>';
  }
}

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  var parts = el.dataset.action.split('.');
  var ctx = window,
    fn = window;
  for (var i = 0; i < parts.length; i++) {
    ctx = fn;
    fn = fn[parts[i]];
    if (!fn) return;
  }
  if (typeof fn !== 'function') return;
  var args = [];
  if (el.dataset.args) {
    try {
      args = JSON.parse(el.dataset.args);
    } catch (_e) {
      return;
    }
  }
  fn.apply(ctx, args);
});

loadPage();
