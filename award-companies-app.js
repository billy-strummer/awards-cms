/* award_companies.html extracted scripts — SA2-C1 CSP inline-script fix */

const { getAuthToken, proxyFetch, escapeHtml, escapeAttr } = window.publicUtils;

let allCompanies = [];
let awardName = null;
let awardData = null;

async function loadCompaniesPage() {
  awardName = sessionStorage.getItem('selectedAwardName');

  if (!awardName) {
    document.getElementById('awardTitle').textContent = 'Award not found';
    return;
  }

  document.getElementById('awardTitle').textContent = awardName;

  const awardsResult = await proxyFetch({
    table: 'awards',
    operation: 'select',
    select: '*',
    filters: { award_name: awardName },
    pageSize: 1,
  });
  const awards = awardsResult.data || [];

  if (awards.length > 0) {
    awardData = awards[0];
  }

  const orgsResult = await proxyFetch({
    table: 'organisations',
    operation: 'select',
    select: '*',
    filters: { award_name: awardName },
    pageSize: 1000,
  });
  const orgs = orgsResult.data || [];

  allCompanies = orgs;
  displayCompanies(allCompanies);
}

function displayCompanies(companies) {
  const tbody = document.getElementById('companiesTableBody');

  if (companies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No companies found</td></tr>';
    return;
  }

  tbody.innerHTML = companies
    .map((company) => {
      let status = 'Nominee';
      if (awardData && awardData.winner === company.company_name) {
        status = '<span class="badge bg-success">WINNER</span>';
      }

      return `
      <tr>
        <td><a class="company-link" data-action="openCompanyProfile" data-args='["${escapeAttr(company.id)}","${escapeAttr(company.company_name)}"]'>${escapeHtml(company.company_name)}</a></td>
        <td><a href="mailto:${escapeAttr(company.email)}">${escapeHtml(company.email)}</a></td>
        <td><a href="${escapeAttr(company.website)}" target="_blank">${escapeHtml(company.website) || 'N/A'}</a></td>
        <td>${escapeHtml(company.region)}</td>
        <td>${status}</td>
        <td>
          <a href="#" data-action="openCompanyProfile" data-args='["${escapeAttr(company.id)}","${escapeAttr(company.company_name)}"]' class="btn btn-sm btn-link p-0">
            <i class="bi bi-eye"></i>
          </a>
        </td>
      </tr>
    `;
    })
    .join('');
}

function filterCompanies() {
  const searchInput = document.getElementById('searchInput').value.toLowerCase();

  const filtered = allCompanies.filter((company) => {
    return (company.company_name || '').toLowerCase().includes(searchInput);
  });

  displayCompanies(filtered);
}

function openCompanyProfile(companyId, companyName) {
  sessionStorage.setItem('selectedCompanyId', companyId);
  sessionStorage.setItem('selectedCompanyName', companyName);
  window.location.href = 'company-profile.html';
}

function goBack() {
  window.history.back();
}

document.getElementById('searchInput').addEventListener('keyup', filterCompanies);

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

loadCompaniesPage();
