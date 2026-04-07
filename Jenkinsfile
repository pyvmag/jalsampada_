pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                // This pulls the latest code from your server's folder
                dir('/home/erpadmin/bench-Jalsampada/apps/Jalsampada_ui') {
                    sh 'git pull origin develop'
                }
            }
        }
        
        stage('Build & Deploy') {
            steps {
                dir('/home/erpadmin/bench-Jalsampada/apps/Jalsampada_ui') {
                    // Your Docker commands
                    sh 'docker compose build --parallel'
                    sh 'docker compose up -d'
                }
            }
        }
        
        stage('Cleanup') {
            steps {
                sh 'docker image prune -f --filter "until=24h"'
            }
        }
    }
}
