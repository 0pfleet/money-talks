FROM python:3.12-slim

# System deps for matplotlib rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfreetype6 libpng16-16 libjpeg62-turbo \
    && rm -rf /var/lib/apt/lists/*

# Python packages: kernel gateway + analysis stack
RUN pip install --no-cache-dir \
    jupyter_kernel_gateway==3.0.1 \
    ipykernel \
    pandas \
    numpy \
    matplotlib \
    matplotlib-inline \
    plotly \
    duckdb \
    kaleido

# Non-interactive matplotlib backend
ENV MPLBACKEND=agg

# Create non-root user
RUN useradd -m -s /bin/bash adviser
USER adviser
WORKDIR /home/adviser

# IPython startup: pre-load libraries and DuckDB connection
RUN mkdir -p /home/adviser/.ipython/profile_default/startup
COPY --chown=adviser:adviser startup.py /home/adviser/.ipython/profile_default/startup/00-startup.py

# Data lake mount point
RUN mkdir -p /home/adviser/lake

EXPOSE 8888

CMD ["jupyter", "kernelgateway", \
     "--KernelGatewayApp.ip=0.0.0.0", \
     "--KernelGatewayApp.port=8888", \
     "--KernelGatewayApp.allow_origin=*", \
     "--KernelGatewayApp.prespawn_count=1"]
