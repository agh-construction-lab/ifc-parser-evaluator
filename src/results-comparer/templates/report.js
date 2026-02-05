// Chart.js configuration
Chart.defaults.color = '#656d76';
Chart.defaults.borderColor = '#d0d7de';

// Initialize charts with data from window.reportData
(function () {
    const { matchRateData, processingTimeData, vertexData, uniqueVertexData, triangleData } = window.reportData;

    // Match Rate Chart
    new Chart(document.getElementById('matchRateChart'), {
        type: 'bar',
        data: {
            labels: matchRateData.labels,
            datasets: [{
                data: matchRateData.values,
                backgroundColor: matchRateData.values.map(v => v === 100 ? '#3fb950' : v >= 50 ? '#d29922' : '#f85149'),
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: v => v + '%' }
                }
            }
        }
    });

    // Processing Time Chart
    const files = [...new Set(processingTimeData.map(d => d.file))];
    const parsers = [...new Set(processingTimeData.map(d => d.parser))];

    new Chart(document.getElementById('processingTimeChart'), {
        type: 'bar',
        data: {
            labels: files,
            datasets: parsers.map((parser, i) => ({
                label: parser,
                data: files.map(f => processingTimeData.find(d => d.file === f && d.parser === parser)?.time || 0),
                backgroundColor: i === 0 ? '#58a6ff' : '#a371f7',
                borderRadius: 4,
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => v + 'ms' }
                }
            }
        }
    });

    // Total Vertex Count Chart
    new Chart(document.getElementById('vertexChart'), {
        type: 'bar',
        data: {
            labels: vertexData.map(d => d.file),
            datasets: vertexData[0]?.parsers.map((parser, i) => ({
                label: parser,
                data: vertexData.map(d => d.counts[i] || 0),
                backgroundColor: i === 0 ? '#58a6ff' : '#a371f7',
                borderRadius: 4,
            })) || []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Unique Vertex Count Chart
    new Chart(document.getElementById('uniqueVertexChart'), {
        type: 'bar',
        data: {
            labels: uniqueVertexData.map(d => d.file),
            datasets: uniqueVertexData[0]?.parsers.map((parser, i) => ({
                label: parser,
                data: uniqueVertexData.map(d => d.counts[i] || 0),
                backgroundColor: i === 0 ? '#58a6ff' : '#a371f7',
                borderRadius: 4,
            })) || []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Triangle Count Chart
    new Chart(document.getElementById('triangleChart'), {
        type: 'bar',
        data: {
            labels: triangleData.map(d => d.file),
            datasets: triangleData[0]?.parsers.map((parser, i) => ({
                label: parser,
                data: triangleData.map(d => d.counts[i] || 0),
                backgroundColor: i === 0 ? '#58a6ff' : '#a371f7',
                borderRadius: 4,
            })) || []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Geometry Charts: By IFC Class
    const { vertexByClassData } = window.reportData;

    if (vertexByClassData) {
        // List classes without geometry
        if (vertexByClassData.withoutGeometry && vertexByClassData.withoutGeometry.length > 0) {
            const container = document.getElementById('classesWithoutGeometry');
            container.innerHTML = `
                <div class="no-geometry-notice">
                    <h4>Classes without geometry:</h4>
                    <p>${vertexByClassData.withoutGeometry.map(c => c.ifcClass).join(', ')}</p>
                </div>
            `;
        }

        // Create charts for classes with geometry
        const chartsContainer = document.getElementById('classByClassCharts');

        if (vertexByClassData.withGeometry) {
            for (const classData of vertexByClassData.withGeometry) {
                const safeId = classData.ifcClass.replace(/[^a-zA-Z0-9]/g, '_');
                const chartWrapper = document.createElement('div');
                chartWrapper.className = 'class-charts-wrapper';
                chartWrapper.innerHTML = `
                    <h3>${classData.ifcClass}</h3>
                    <div class="charts-grid">
                        <div class="chart-card">
                            <h4>Total Vertices</h4>
                            <div class="chart-container">
                                <canvas id="vertex-${safeId}"></canvas>
                            </div>
                        </div>
                        <div class="chart-card">
                            <h4>Unique Vertices</h4>
                            <div class="chart-container">
                                <canvas id="unique-${safeId}"></canvas>
                            </div>
                        </div>
                    </div>
                `;
                chartsContainer.appendChild(chartWrapper);

                // Total vertices chart
                new Chart(document.getElementById(`vertex-${safeId}`), {
                    type: 'bar',
                    data: {
                        labels: classData.parsers,
                        datasets: [{
                            data: classData.vertexCounts,
                            backgroundColor: ['#0969da', '#8250df'],
                            borderRadius: 4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true } }
                    }
                });

                // Unique vertices chart
                new Chart(document.getElementById(`unique-${safeId}`), {
                    type: 'bar',
                    data: {
                        labels: classData.parsers,
                        datasets: [{
                            data: classData.uniqueVertexCounts,
                            backgroundColor: ['#0969da', '#8250df'],
                            borderRadius: 4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true } }
                    }
                });
            }
        }
    }

    // Toggle file details
    document.querySelectorAll('.file-header').forEach(header => {
        header.addEventListener('click', () => {
            const details = header.nextElementSibling;
            details.classList.toggle('open');
        });
    });

    // Toggle view tabs
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const viewId = tab.dataset.view;
            const parent = tab.closest('.image-comparison-section');

            parent.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
            parent.querySelectorAll('.view-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(viewId).classList.add('active');
        });
    });
})();
