import os
from celery import Celery
from config import config_map

def make_celery(app_name=__name__):
    env = os.environ.get('FLASK_ENV', 'development')
    cfg = config_map[env]
    celery = Celery(
        app_name,
        backend=cfg.CELERY_RESULT_BACKEND,
        broker=cfg.CELERY_BROKER_URL
    )
    celery.conf.update({
        'task_serializer': 'json',
        'accept_content': ['json'],
        'result_serializer': 'json',
        'timezone': 'UTC',
        'enable_utc': True,
    })
    return celery

celery_app = make_celery()
