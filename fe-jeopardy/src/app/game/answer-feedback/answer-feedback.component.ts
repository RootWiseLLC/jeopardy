import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { GameStateService } from 'src/app/services/game-state.service';
import { ModalService } from 'src/app/services/modal.service';

@Component({
    selector: 'app-answer-feedback',
    templateUrl: './answer-feedback.component.html',
    styleUrls: ['./answer-feedback.component.less']
})
export class AnswerFeedbackComponent implements OnInit, OnDestroy {
    private correctAudio: HTMLAudioElement;
    private wrongAudio: HTMLAudioElement;
    private dailyDoubleAudio: HTMLAudioElement;
    private hideTimeout: any;

    constructor(
        protected game: GameStateService,
        protected modal: ModalService
    ) {
        this.correctAudio = new Audio('../../../assets/correct.mp3');
        this.wrongAudio = new Audio('../../../assets/wrong.mp3');
        this.dailyDoubleAudio = new Audio('../../../assets/daily_double.mp3');
    }

    ngOnInit() {
        // Play sound effect based on feedback type
        this.playSound();

        // Auto-hide after 1 second
        this.hideTimeout = setTimeout(() => {
            this.modal.hideAnswerFeedback();
        }, 1000);
    }

    ngOnDestroy() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
    }

    playSound() {
        // Check if music/sound is enabled
        const playMusic = localStorage.getItem('playMusic') !== 'false';

        if (playMusic) {
            if (this.isDailyDouble()) {
                this.dailyDoubleAudio.play().catch(err => console.log('Audio play failed:', err));
            } else if (this.isCorrect()) {
                this.correctAudio.play().catch(err => console.log('Audio play failed:', err));
            } else {
                this.wrongAudio.play().catch(err => console.log('Audio play failed:', err));
            }
        }
    }

    isCorrect(): boolean {
        const feedbackType = this.modal.getAnswerFeedbackType();
        return feedbackType === 'correct';
    }

    isIncorrect(): boolean {
        const feedbackType = this.modal.getAnswerFeedbackType();
        return feedbackType === 'incorrect';
    }

    isTimeout(): boolean {
        const feedbackType = this.modal.getAnswerFeedbackType();
        return feedbackType === 'timeout';
    }

    isDailyDouble(): boolean {
        const feedbackType = this.modal.getAnswerFeedbackType();
        return feedbackType === 'daily-double';
    }
}
