// Chart.js configuration
Chart.defaults.color = '#656d76';
Chart.defaults.borderColor = '#d0d7de';

// Initialize charts with data from window.reportData
(function () {
    const { processingTimeData, vertexData, uniqueVertexData, triangleData } = window.reportData;

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
                chartWrapper.className = 'collapsible-section class-collapsible';
                chartWrapper.innerHTML = `
                    <div class="collapsible-header">
                        <h3>${classData.ifcClass}</h3>
                        <span class="toggle-icon">▼</span>
                    </div>
                    <div class="collapsible-content">
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

    // Toggle inner collapsible sections (Matrix Comparison)
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            header.parentElement.classList.toggle('open');
        });
    });

    function parseViewPairs(viewContent) {
        const dataNode = viewContent.querySelector('.view-pairs-data');

        if (!dataNode) {
            return {};
        }

        try {
            return JSON.parse(dataNode.textContent || '{}');
        } catch (error) {
            console.error('Could not parse visual comparison pair data', error);
            return {};
        }
    }

    function setImageSource(image, source) {
        if (!image) {
            return;
        }

        if (!source) {
            image.style.display = 'none';
            image.removeAttribute('src');
            return;
        }

        image.style.display = '';
        image.src = source;
    }

    function updateViewContent(viewContent, leftParserId, rightParserId) {
        const pairData = parseViewPairs(viewContent);
        const selectedPair = pairData[leftParserId]?.[rightParserId];

        if (!selectedPair) {
            return;
        }

        const parserALabel = viewContent.querySelector('.parser-a-label');
        const parserBLabel = viewContent.querySelector('.parser-b-label');
        const diffLabel = viewContent.querySelector('.diff-label');
        const parserAImage = viewContent.querySelector('.parser-a-image');
        const parserBImage = viewContent.querySelector('.parser-b-image');
        const diffImage = viewContent.querySelector('.diff-image');
        const parserAOnionImage = viewContent.querySelector('.parser-a-onion-image');
        const parserBOnionImage = viewContent.querySelector('.parser-b-onion-image');
        const parserASliderLabel = viewContent.querySelector('.parser-a-slider-label');
        const parserBSliderLabel = viewContent.querySelector('.parser-b-slider-label');

        if (parserALabel) parserALabel.textContent = selectedPair.leftLabel;
        if (parserBLabel) parserBLabel.textContent = selectedPair.rightLabel;
        if (diffLabel) diffLabel.textContent = `Difference (${selectedPair.diffPercentage})`;
        if (parserASliderLabel) parserASliderLabel.textContent = selectedPair.leftLabel;
        if (parserBSliderLabel) parserBSliderLabel.textContent = selectedPair.rightLabel;

        setImageSource(parserAImage, selectedPair.imageAPath);
        setImageSource(parserBImage, selectedPair.imageBPath);
        setImageSource(diffImage, selectedPair.diffImagePath);
        setImageSource(parserAOnionImage, selectedPair.imageAPath);
        setImageSource(parserBOnionImage, selectedPair.imageBPath);
    }

    function updateViewTabStatus(section, leftParserId, rightParserId) {
        section.querySelectorAll('.view-content').forEach(viewContent => {
            const pairData = parseViewPairs(viewContent);
            const selectedPair = pairData[leftParserId]?.[rightParserId];
            const tabStatus = section.querySelector(`.view-tab[data-view="${viewContent.id}"] .view-tab-status`);

            if (!tabStatus || !selectedPair) {
                return;
            }

            tabStatus.className = `match-icon view-tab-status ${selectedPair.matchClass}`;
        });
    }

    function applySelectedParserPair(section) {
        const leftSelect = section.querySelector('.parser-select-left');
        const rightSelect = section.querySelector('.parser-select-right');

        if (!leftSelect || !rightSelect) {
            return;
        }

        const leftParserId = leftSelect.value;
        const rightParserId = rightSelect.value;

        section.querySelectorAll('.view-content').forEach(viewContent => {
            updateViewContent(viewContent, leftParserId, rightParserId);
        });

        updateViewTabStatus(section, leftParserId, rightParserId);
    }

    document.querySelectorAll('.image-comparison-section').forEach(section => {
        const leftSelect = section.querySelector('.parser-select-left');
        const rightSelect = section.querySelector('.parser-select-right');

        if (!leftSelect || !rightSelect) {
            return;
        }

        leftSelect.dataset.previousValue = leftSelect.value;
        rightSelect.dataset.previousValue = rightSelect.value;

        function handleParserChange(changedSelect, otherSelect) {
            const previousValue = changedSelect.dataset.previousValue || changedSelect.value;

            if (changedSelect.value === otherSelect.value) {
                otherSelect.value = previousValue !== changedSelect.value
                    ? previousValue
                    : Array.from(otherSelect.options).find(option => option.value !== changedSelect.value)?.value || otherSelect.value;
            }

            changedSelect.dataset.previousValue = changedSelect.value;
            otherSelect.dataset.previousValue = otherSelect.value;

            applySelectedParserPair(section);
        }

        leftSelect.addEventListener('change', () => handleParserChange(leftSelect, rightSelect));
        rightSelect.addEventListener('change', () => handleParserChange(rightSelect, leftSelect));

        section.querySelectorAll('.view-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const viewId = tab.dataset.view;

                section.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
                section.querySelectorAll('.view-content').forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(viewId).classList.add('active');
            });
        });

        applySelectedParserPair(section);
    });
})();
