-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('LOBBY', 'IN_PROGRESS', 'FINISHED', 'ABORTED');

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'uz',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "timeLimit" INTEGER NOT NULL DEFAULT 20,
    "points" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'LOBBY',
    "streakBonus" INTEGER NOT NULL DEFAULT 100,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "reconnectToken" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAnswer" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "answerIds" TEXT[],
    "isCorrect" BOOLEAN NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "questionIdx" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "streak" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "finalRank" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "totalAnswered" INTEGER NOT NULL,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");
CREATE INDEX "Quiz_teacherId_updatedAt_idx" ON "Quiz"("teacherId", "updatedAt");
CREATE INDEX "Question_quizId_position_idx" ON "Question"("quizId", "position");
CREATE INDEX "Answer_questionId_position_idx" ON "Answer"("questionId", "position");
CREATE INDEX "GameSession_pin_status_idx" ON "GameSession"("pin", "status");
CREATE INDEX "GameSession_teacherId_createdAt_idx" ON "GameSession"("teacherId", "createdAt");
CREATE INDEX "GameSession_quizId_idx" ON "GameSession"("quizId");
CREATE UNIQUE INDEX "Player_reconnectToken_key" ON "Player"("reconnectToken");
CREATE INDEX "Player_gameId_idx" ON "Player"("gameId");
CREATE UNIQUE INDEX "Player_gameId_nickname_key" ON "Player"("gameId", "nickname");
CREATE INDEX "PlayerAnswer_gameId_questionId_idx" ON "PlayerAnswer"("gameId", "questionId");
CREATE UNIQUE INDEX "PlayerAnswer_playerId_questionId_key" ON "PlayerAnswer"("playerId", "questionId");
CREATE UNIQUE INDEX "Score_playerId_questionIdx_key" ON "Score"("playerId", "questionIdx");
CREATE UNIQUE INDEX "GameResult_playerId_key" ON "GameResult"("playerId");
CREATE INDEX "GameResult_gameId_finalRank_idx" ON "GameResult"("gameId", "finalRank");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Player" ADD CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerAnswer" ADD CONSTRAINT "PlayerAnswer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerAnswer" ADD CONSTRAINT "PlayerAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Score" ADD CONSTRAINT "Score_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
