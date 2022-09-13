FROM public.ecr.aws/lambda/python:3.9

COPY dyndb-importer.py ${LAMBDA_TASK_ROOT}
COPY requirements.txt .

RUN pip3 install -r requirements.txt --target ${LAMBDA_TASK_ROOT}

CMD [ "dyndb-importer.lambda_handler" ]