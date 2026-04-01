document.addEventListener('DOMContentLoaded', async () => {
    let appData = null;
    let mainChart = null;
    let threatChart = null;
    let disasterChart = null;

    const countrySelects = [
        document.getElementById('country-1'),
        document.getElementById('country-2'),
        document.getElementById('country-3')
    ];
    const threatSelect = document.getElementById('threat-select');
    const disasterSelect = document.getElementById('disaster-select');
    const cardsContainer = document.getElementById('comparison-cards');

    const colors = ['#818cf8', '#34d399', '#f472b6'];

    try {
        const response = await fetch('processed_data.json');
        appData = await response.json();
        initializeInputs();
        initializeCharts();
        updateUI();
    } catch (error) {
        console.error('Error loading data:', error);
    }

    function initializeInputs() {
        appData.threatTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            threatSelect.appendChild(option);
        });

        appData.disasterTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            disasterSelect.appendChild(option);
        });

        const sortedCountries = [...appData.countries].sort((a, b) => a.name.localeCompare(b.name));
        countrySelects.forEach((select, index) => {
            sortedCountries.forEach(country => {
                const option = document.createElement('option');
                option.value = country.id;
                option.textContent = country.name;
                select.appendChild(option);
            });
            if (index === 0 && sortedCountries.length > 0) {
                const defaultCountry = sortedCountries.find(c => c.name.toLowerCase().includes('united states')) || sortedCountries[0];
                select.value = defaultCountry.id;
            }
        });

        [...countrySelects, threatSelect, disasterSelect].forEach(el => {
            el.addEventListener('change', updateUI);
        });
    }

    function initializeCharts() {
        const ctxMain = document.getElementById('mobilizationChart').getContext('2d');
        const ctxThreat = document.getElementById('threatBarChart').getContext('2d');
        const ctxDisaster = document.getElementById('disasterBarChart').getContext('2d');
        
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Inter', sans-serif";

        // Capacity Plugin for Scatter Plot
        const capacityPlugin = {
            id: 'capacityArea',
            beforeDatasetsDraw(chart) {
                if (chart.config.type !== 'scatter') return;
                const { ctx, chartArea, scales: { x, y } } = chart;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x.getPixelForValue(0), y.getPixelForValue(100));
                ctx.lineTo(x.getPixelForValue(100), y.getPixelForValue(100));
                ctx.lineTo(x.getPixelForValue(100), y.getPixelForValue(0));
                ctx.closePath();
                ctx.fillStyle = 'rgba(153, 27, 27, 0.2)';
                ctx.fill();
                ctx.restore();
            }
        };

        // Main Scatter Chart
        mainChart = new Chart(ctxMain, {
            type: 'scatter',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: '% Force for Natural Disasters', color: '#f8fafc' }, min: 0, max: 100 },
                    y: { title: { display: true, text: '% Force for Nat. Security Threats', color: '#f8fafc' }, min: 0, max: 100 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (c) => [`${c.raw.name}`, `${c.raw.disasterType}: ${c.raw.x.toFixed(2)}%`, `${c.raw.threatType}: ${c.raw.y.toFixed(2)}%`]
                        }
                    }
                }
            },
            plugins: [capacityPlugin]
        });

        const barOptions = (title) => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 20 } },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const val = c.raw.toFixed(2);
                            const count = ((c.raw / 100) * c.dataset.totalPersonnel).toLocaleString();
                            return `${c.dataset.label}: ${val}% (~${count} personnel)`;
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, max: 100, title: { display: true, text: '% of Military Personnel' } }
            }
        });

        // Threat Bar Chart
        threatChart = new Chart(ctxThreat, {
            type: 'bar',
            data: { labels: appData.threatTypes, datasets: [] },
            options: barOptions('Threats')
        });

        // Disaster Bar Chart
        disasterChart = new Chart(ctxDisaster, {
            type: 'bar',
            data: { labels: appData.disasterTypes, datasets: [] },
            options: barOptions('Disasters')
        });
    }

    function updateUI() {
        const threatVal = threatSelect.value;
        const disasterVal = disasterSelect.value;
        const selectedCountries = countrySelects.map(s => s.value).filter(val => val !== "");

        const scatterDatasets = [];
        const threatDatasets = [];
        const disasterDatasets = [];

        // Add Threshold lines to main chart
        scatterDatasets.push({ label: '60% Threshold', data: [{x: 0, y: 60}, {x: 60, y: 0}], borderColor: 'rgba(148, 163, 184, 0.3)', borderDash: [5, 5], pointRadius: 0, showLine: true });
        scatterDatasets.push({ label: '80% Threshold', data: [{x: 0, y: 80}, {x: 80, y: 0}], borderColor: 'rgba(148, 163, 184, 0.4)', borderDash: [10, 5], pointRadius: 0, showLine: true });
        scatterDatasets.push({ label: '100% Capacity', data: [{x: 0, y: 100}, {x: 100, y: 0}], borderColor: 'rgba(248, 113, 113, 0.5)', pointRadius: 0, showLine: true, borderWidth: 2 });

        cardsContainer.innerHTML = '';

        selectedCountries.forEach((countryId, idx) => {
            const c = appData.countries.find(x => x.id === countryId);
            if (!c) return;

            // Scatter Data
            const tList = threatVal === 'all' ? appData.threatTypes : [threatVal];
            const dList = disasterVal === 'all' ? appData.disasterTypes : [disasterVal];
            const points = [];
            tList.forEach(t => dList.forEach(d => {
                points.push({ x: c.disasters[d].value, y: c.threats[t].value, name: c.name, threatType: t, disasterType: d });
            }));

            scatterDatasets.push({ label: c.name, data: points, backgroundColor: colors[idx] + 'aa', borderColor: colors[idx], pointRadius: 6 });

            // Threat Bar Data
            threatDatasets.push({
                label: c.name,
                data: appData.threatTypes.map(t => c.threats[t].value),
                backgroundColor: colors[idx],
                totalPersonnel: c.totalForce
            });

            // Disaster Bar Data
            disasterDatasets.push({
                label: c.name,
                data: appData.disasterTypes.map(d => c.disasters[d].value),
                backgroundColor: colors[idx],
                totalPersonnel: c.totalForce
            });

            if (threatVal !== 'all' && disasterVal !== 'all') {
                createCard(c, threatVal, c.threats[threatVal], disasterVal, c.disasters[disasterVal], colors[idx]);
            } else {
                createSummaryCard(c, colors[idx], points);
            }
        });

        mainChart.data.datasets = scatterDatasets;
        mainChart.update();

        threatChart.data.datasets = threatDatasets;
        threatChart.update();

        disasterChart.data.datasets = disasterDatasets;
        disasterChart.update();
    }

    function createSummaryCard(country, color, points) {
        const card = document.createElement('div');
        card.className = 'card glass';
        card.style.borderTop = `4px solid ${color}`;
        const over = points.filter(p => p.x + p.y > 100).length;
        card.innerHTML = `
            <h4>${country.name} <span class="data-label">Force: ${(country.totalForce/1000000).toFixed(2)}M</span></h4>
            <div class="data-row"><span class="data-label">Scenarios Count</span><span class="data-value">${points.length}</span></div>
            <div class="data-row"><span class="data-label">Over-Capacity Risks</span><span class="data-value" style="color:#f87171">${over}</span></div>
            <div class="data-row" style="margin-top:0.5rem;font-size:0.7rem"><span class="data-label">Region</span><span>${country.subregion}</span></div>
        `;
        cardsContainer.appendChild(card);
    }

    function createCard(country, tName, tData, dName, dData, color) {
        const card = document.createElement('div');
        card.className = 'card glass';
        card.style.borderTop = `4px solid ${color}`;
        const fmt = (v) => v.toFixed(2) + '%';
        card.innerHTML = `
            <h4>${country.name} <span class="data-label">Force: ${(country.totalForce/1000000).toFixed(2)}M</span></h4>
            <div class="data-row"><span class="data-label">${dName}</span><span class="data-value">${fmt(dData.value)} ${dData.isImputed ? '<span class="imputed-tag">Subregion Median</span>' : ''}</span></div>
            <div class="data-row"><span class="data-label">${tName}</span><span class="data-value">${fmt(tData.value)} ${tData.isImputed ? '<span class="imputed-tag">Subregion Avg</span>' : ''}</span></div>
            <div class="data-row" style="margin-top:0.5rem;font-size:0.7rem"><span class="data-label">Region</span><span>${country.subregion}</span></div>
        `;
        cardsContainer.appendChild(card);
    }
});
