import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ModalService } from 'src/app/services/modal.service';
import { Player, ServerUnavailableMsg } from '../../model/model';
import { ApiService } from '../../services/api.service';
import { GameStateService } from '../../services/game-state.service';
import { PlayerService } from '../../services/player.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
	selector: 'app-post-game',
	templateUrl: './post-game.component.html',
	styleUrls: ['./post-game.component.less']
})
export class PostGameComponent implements OnInit, OnDestroy {
	protected revealedPlayerIds: Set<string> = new Set();
	protected showWinner: boolean = false;
	private revealTimeouts: any[] = [];

	constructor(
		private router: Router,
		private api: ApiService,
		private websocket: WebsocketService,
		protected game: GameStateService,
		protected player: PlayerService,
		private modal: ModalService,
	) { }

	ngOnInit() {
		// Start revealing players sequentially with 2-second delays
		const players = this.game.Players().filter(p => p.finalAnswer !== '');

		players.forEach((player, index) => {
			// First player appears after 2 seconds, then each subsequent player after 2 more seconds
			const delay = (index + 1) * 2000;
			const timeout = setTimeout(() => {
				this.revealedPlayerIds.add(player.id);
			}, delay);
			this.revealTimeouts.push(timeout);
		});

		// Show winner after all players have been revealed (add one more 2-second delay)
		const winnerDelay = (players.length + 1) * 2000;
		const winnerTimeout = setTimeout(() => {
			this.showWinner = true;
		}, winnerDelay);
		this.revealTimeouts.push(winnerTimeout);
	}

	ngOnDestroy() {
		// Clean up timeouts when component is destroyed
		this.revealTimeouts.forEach(timeout => clearTimeout(timeout));
	}

	isPlayerRevealed(playerId: string): boolean {
		return this.revealedPlayerIds.has(playerId);
	}

	canProtestForPlayer(player: Player): boolean {
		return !Object.keys(player.finalProtestors).includes(this.player.Id());
	}

	protestFinalCorrectness(playerId: string) {
		this.websocket.Send({
			state: this.game.State(),
			protestFor: playerId
		});
	}

	playAgain() {
		return this.api.PlayAgain().subscribe({
			next: (resp: any) => {
			},
			error: (err: any) => {
				let msg = err.status != 0 ? err.error.message : ServerUnavailableMsg;
				this.modal.displayMessage(msg)
			},
		})
	}

	leaveGame() {
		return this.api.LeaveGame().subscribe({
			next: (resp: any) => {
				this.router.navigate(['/'])
			},
			error: (err: any) => {
				let msg = err.status != 0 ? err.error.message : ServerUnavailableMsg;
				console.error(msg)
				this.router.navigate(['/'])
			},
		})
	}
}
