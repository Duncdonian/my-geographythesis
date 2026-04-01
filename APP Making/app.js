document.addEventListener('DOMContentLoaded', async () => {
    let appData = null;
    let chart = null;

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
        initializeChart();
        updateUI();
    } catch (error) {
        console.error('Error loading data:', error);
    }

    function initializeInputs() {
        // Populate Threats
        appData.threatTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            threatSelect.appendChild(option);
        });

        // Populate Disasters
        appData.disasterTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            disasterSelect.appendChild(option);
        });

        // Populate Countries
        const sortedCountries = [...appData.countries].sort((a, b) => a.name.localeCompare(b.name));
        countrySelects.forEach((select, index) => {
            sortedCountries.forEach(country => {
                const option = document.createElement('option');
                option.value = country.id;
                option.textContent = country.name;
                select.appendChild(option);
            });
            // Set default for first select
            if (index === 0 && sortedCountries.length > 0) {
                // Try to find Japan or USA as default
                const defaultCountry = sortedCountries.find(c => c.name.toLowerCase().includes('united states')) || sortedCountries[0];
                select.value = defaultCountry.id;
            }
        });

        // Add Event Listeners
        [...countrySelects, threatSelect, disasterSelect].forEach(el => {
            el.addEventListener('change', updateUI);
        });
    }

    function initializeChart() {
        const ctx = document.getElementById('mobilizationChart').getContext('2d');
        
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Inter', sans-serif";

        const capacityPlugin = {
            id: 'capacityArea',
            beforeDatasetsDraw(chart) {
                const { ctx, chartArea, scales: { x, y } } = chart;
                ctx.save();
                ctx.beginPath();
                // Draw red area for X + Y > 100
                // Triangle points: (0, 100) -> (100, 100) -> (100, 0) -> (0, 100)
                ctx.moveTo(x.getPixelForValue(0), y.getPixelForValue(100));
                ctx.lineTo(x.getPixelForValue(100), y.getPixelForValue(100));
                ctx.lineTo(x.getPixelForValue(100), y.getPixelForValue(0));
                ctx.closePath();
                ctx.fillStyle = 'rgba(153, 27, 27, 0.2)'; // Darkish red
                ctx.fill();
                ctx.restore();
            }
        };

        chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: '% Military Personnel for Natural Disasters', color: '#f8fafc', font: { size: 14, weight: '600' } },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        min: 0,
                        max: 100
                    },
                    y: {
                        title: { display: true, text: '% Military Personnel for National Security Threats', color: '#f8fafc', font: { size: 14, weight: '600' } },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        min: 0,
                        max: 100
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const p = context.raw;
                                if (!p.name) return null;
                                return [
                                    `${p.name}`,
                                    `Disaster: ${p.disasterType} (${p.x.toFixed(2)}%)`,
                                    `Threat: ${p.threatType} (${p.y.toFixed(2)}%)`
                                ];
                            }
                        }
                    }
                }
            },
            plugins: [capacityPlugin]
        });
    }

    function updateUI() {
        const threatVal = threatSelect.value;
        const disasterVal = disasterSelect.value;
        const selectedCountries = countrySelects.map(s => s.value).filter(val => val !== "");

        const datasets = [];

        // Threshold Lines (Diagonal: X + Y = C)
        datasets.push({
            label: '60% Threshold',
            data: [{x: 0, y: 60}, {x: 60, y: 0}],
            borderColor: 'rgba(148, 163, 184, 0.3)',
            borderDash: [5, 5],
            pointRadius: 0,
            showLine: true
        });
        datasets.push({
            label: '80% Threshold',
            data: [{x: 0, y: 80}, {x: 80, y: 0}],
            borderColor: 'rgba(148, 163, 184, 0.4)',
            borderDash: [10, 5],
            pointRadius: 0,
            showLine: true
        });
        datasets.push({
            label: '100% Capacity',
            data: [{x: 0, y: 100}, {x: 100, y: 0}],
            borderColor: 'rgba(248, 113, 113, 0.5)',
            pointRadius: 0,
            showLine: true,
            borderWidth: 2
        });

        cardsContainer.innerHTML = '';

        selectedCountries.forEach((countryId, countryIndex) => {
            const countryData = appData.countries.find(c => c.id === countryId);
            if (!countryData) return;

            const tTypes = threatVal === 'all' ? appData.threatTypes : [threatVal];
            const dTypes = disasterVal === 'all' ? appData.disasterTypes : [disasterVal];

            const points = [];
            
            tTypes.forEach(t => {
                dTypes.forEach(d => {
                    const tData = countryData.threats[t] || { value: 0, isImputed: true };
                    const dData = countryData.disasters[d] || { value: 0, isImputed: true };
                    
                    points.push({
                        x: dData.value,
                        y: tData.value,
                        name: countryData.name,
                        threatType: t,
                        disasterType: d,
                        isImputed: tData.isImputed || dData.isImputed
                    });
                });
            });

            datasets.push({
                label: countryData.name,
                data: points,
                backgroundColor: colors[countryIndex] + 'aa', // slightly transparent
                borderColor: colors[countryIndex],
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false
            });

            if (threatVal !== 'all' && disasterVal !== 'all') {
                const tData = countryData.threats[threatVal] || { value: 0, isImputed: true };
                const dData = countryData.disasters[disasterVal] || { value: 0, isImputed: true };
                createCard(countryData, threatVal, tData, disasterVal, dData, colors[countryIndex]);
            } else {
                createSummaryCard(countryData, colors[countryIndex], points);
            }
        });

        chart.data.datasets = datasets;
        chart.update();
    }

    function createSummaryCard(country, color, points) {
        const card = document.createElement('div');
        card.className = 'card glass';
        card.style.borderTop = `4px solid ${color}`;

        const overCapacity = points.filter(p => p.x + p.y > 100).length;

        card.innerHTML = `
            <h4>
                ${country.name}
                <span class="data-label" style="font-size: 0.8rem">Force: ${(country.totalForce/1000000).toFixed(2)}M</span>
            </h4>
            <div class="data-row">
                <span class="data-label">Data Points Showed</span>
                <span class="data-value">${points.length}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Over-Capacity Risks</span>
                <span class="data-value" style="color: ${overCapacity > 0 ? '#f87171' : 'inherit'}">${overCapacity} scenarios</span>
            </div>
             <div class="data-row" style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem">
                <span class="data-label" style="font-size: 0.75rem">Subregion</span>
                <span class="data-value" style="font-size: 0.75rem">${country.subregion}</span>
            </div>
        `;
        cardsContainer.appendChild(card);
    }

    function createCard(country, threatName, threatData, disasterName, disasterData, color) {
        const card = document.createElement('div');
        card.className = 'card glass';
        card.style.borderTop = `4px solid ${color}`;

        const formatVal = (v) => v !== null ? v.toFixed(2) + '%' : 'N/A';

        card.innerHTML = `
            <h4>
                ${country.name}
                <span class="data-label" style="font-size: 0.8rem">Force: ${(country.totalForce/1000000).toFixed(2)}M</span>
            </h4>
            <div class="data-row">
                <span class="data-label">${disasterName}</span>
                <span class="data-value">
                    ${formatVal(disasterData.value)}
                    ${disasterData.isImputed ? '<span class="imputed-tag">Subregion Median</span>' : ''}
                </span>
            </div>
             <div class="data-row">
                <span class="data-label">${threatName}</span>
                <span class="data-value">
                    ${formatVal(threatData.value)}
                    ${threatData.isImputed ? '<span class="imputed-tag">Subregion Avg</span>' : ''}
                </span>
            </div>
            <div class="data-row" style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem">
                <span class="data-label" style="font-size: 0.75rem">Subregion</span>
                <span class="data-value" style="font-size: 0.75rem">${country.subregion}</span>
            </div>
        `;
        cardsContainer.appendChild(card);
    }
});
