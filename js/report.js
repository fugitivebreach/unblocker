// Character count tracking and dynamic form handling
document.addEventListener('DOMContentLoaded', () => {
    // Handle report type changes
    const reportTypeRadios = document.querySelectorAll('input[name="reportType"]');
    reportTypeRadios.forEach(radio => {
        radio.addEventListener('change', handleReportTypeChange);
    });
    
    // Set up character counters for all textareas
    setupCharacterCounters();
    
    // Set default time to current time
    const timeInput = document.getElementById('timeOfIncident');
    if (timeInput) {
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        timeInput.value = localDateTime;
    }
});

function handleReportTypeChange(e) {
    const selectedType = e.target.value;
    
    // Hide all dynamic sections
    const dynamicSections = document.querySelectorAll('.dynamic-section');
    dynamicSections.forEach(section => {
        section.style.display = 'none';
        // Clear required attributes from hidden fields
        const requiredFields = section.querySelectorAll('[required]');
        requiredFields.forEach(field => field.removeAttribute('required'));
    });
    
    // Show the relevant section and set required attributes
    let targetSection;
    switch(selectedType) {
        case 'teacher_spotted':
            targetSection = document.getElementById('teacher-fields');
            break;
        case 'technical_issue':
            targetSection = document.getElementById('technical-fields');
            break;
        case 'content_issue':
            targetSection = document.getElementById('content-fields');
            break;
        case 'other':
            targetSection = document.getElementById('other-fields');
            break;
    }
    
    if (targetSection) {
        targetSection.style.display = 'block';
        // Set required attributes for visible fields
        const requiredFields = targetSection.querySelectorAll('input[type="text"], input[type="url"], input[type="datetime-local"], textarea, input[type="radio"][name="witnessPresent"]');
        requiredFields.forEach(field => {
            if (field.type !== 'radio' || field.name === 'witnessPresent') {
                if (!field.hasAttribute('data-optional')) {
                    field.setAttribute('required', 'required');
                }
            }
        });
        
        // Re-setup character counters for the visible section
        setupCharacterCounters();
    }
}

function setupCharacterCounters() {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        const counter = textarea.parentElement.querySelector('.char-count');
        if (counter && textarea.offsetParent !== null) { // Only if visible
            const maxLength = textarea.getAttribute('maxlength') || 2000;
            
            // Remove existing listeners
            textarea.removeEventListener('input', updateCounter);
            
            // Add new listener
            textarea.addEventListener('input', function updateCounter() {
                const count = textarea.value.length;
                counter.textContent = `${count}/${maxLength}`;
                if (count > maxLength * 0.9) {
                    counter.style.color = '#ff6b6b';
                } else {
                    counter.style.color = '#888';
                }
            });
            
            // Initial update
            const count = textarea.value.length;
            counter.textContent = `${count}/${maxLength}`;
        }
    });
}

function showMessage(message, type) {
    const existingMessage = document.querySelector('.error, .success');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = type;
    messageDiv.textContent = message;
    
    const form = document.querySelector('.report-form');
    form.insertBefore(messageDiv, form.firstChild);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function goBack() {
    window.history.back();
}

// Report form handler
document.getElementById('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const reportData = {
        reportType: formData.get('reportType'),
        urgencyLevel: formData.get('urgencyLevel'),
        description: formData.get('description'),
        location: formData.get('location') || '',
        timeOfIncident: formData.get('timeOfIncident'),
        witnessPresent: formData.get('witnessPresent') === 'true',
        actionTaken: formData.get('actionTaken'),
        additionalInfo: formData.get('additionalInfo') || '',
        // Dynamic fields
        teacherName: formData.get('teacherName') || '',
        deviceType: formData.get('deviceType') || '',
        contentUrl: formData.get('contentUrl') || '',
        contentName: formData.get('contentName') || ''
    };
    
    // Validation - only check required fields based on report type
    if (!reportData.reportType || !reportData.urgencyLevel || !reportData.description || 
        !reportData.timeOfIncident || reportData.witnessPresent === null || 
        !reportData.actionTaken) {
        showMessage('Please fill out all required fields', 'error');
        return;
    }
    
    // Type-specific validation
    if (reportData.reportType === 'teacher_spotted' && !reportData.location) {
        showMessage('Location is required for teacher spotted reports', 'error');
        return;
    }
    
    if (reportData.reportType === 'technical_issue' && (!reportData.location || !reportData.deviceType)) {
        showMessage('Location and device type are required for technical issues', 'error');
        return;
    }
    
    if (reportData.reportType === 'content_issue' && !reportData.contentName) {
        showMessage('Content name is required for content issues', 'error');
        return;
    }
    
    if (reportData.description.length < 20) {
        showMessage('Please provide a more detailed description (at least 20 characters)', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/submit-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reportData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`Report submitted successfully! Report ID: ${data.reportId}`, 'success');
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 3000);
        } else {
            showMessage(data.message || 'Failed to submit report', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
});

// Check if user is authenticated
window.addEventListener('load', async () => {
    try {
        const response = await fetch('/api/check-auth');
        if (!response.ok) {
            window.location.href = '/';
        }
    } catch (error) {
        window.location.href = '/';
    }
});
