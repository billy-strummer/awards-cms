/* winners-portal.html extracted scripts — SA2-C1 CSP inline-script fix */

const { proxyFetch } = window.publicUtils;

async function loadWinnerData() {
  const params = new URLSearchParams(window.location.search);
  const winnerId = params.get('id');
  const token = params.get('token');

  if (!token) {
    document.getElementById('loadingState').classList.add('d-none');
    document.getElementById('errorState').classList.remove('d-none');
    return;
  }

  try {
    const filters = { access_token: token };
    if (winnerId) filters.id = winnerId;

    const result = await proxyFetch({
      table: 'winners',
      operation: 'select',
      select:
        '*, awards:award_years(award_name, award_category, sector, county), organisations(company_name, logo_url)',
      filters: filters,
      pageSize: 1,
    });

    const data = result.data && result.data.length > 0 ? result.data[0] : null;
    if (!data) throw new Error('Winner not found');

    document.getElementById('awardName').textContent = data.awards?.award_name || 'Award Winner';
    document.getElementById('companyName').textContent = data.organisations?.company_name || '';
    document.getElementById('awardCategory').textContent = [data.awards?.sector, data.awards?.county]
      .filter(Boolean)
      .join(' - ');

    document.getElementById('loadingState').classList.add('d-none');
    document.getElementById('winnerContent').classList.remove('d-none');
  } catch (e) {
    console.error('Error:', e);
    document.getElementById('loadingState').classList.add('d-none');
    document.getElementById('errorState').classList.remove('d-none');
  }
}

loadWinnerData();
