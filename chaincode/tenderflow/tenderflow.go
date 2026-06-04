package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// TENDERFLOW — Construction tendering with commit-reveal and on-chain behavior reputation
// Case study: Ma'anshan Yangtze River Bridge procurement simulation

type TenderFlowContract struct {
	contractapi.Contract
}

type TenderRecord struct {
	TenderID      string  `json:"tender_id"`
	ProjectName   string  `json:"project_name"`
	RFPCID        string  `json:"rfp_cid"`
	BidBondPct    float64 `json:"bid_bond_pct"`
	Status        string  `json:"status"`
	Deadline      string  `json:"deadline"`
}

type BidCommitment struct {
	TxType       string `json:"tx_type"`
	TenderID     string `json:"tender_id"`
	BidderID     string `json:"bidder_id"`
	BidHash      string `json:"bid_hash"`
	CommitPhase  string `json:"commit_phase"`
	Timestamp    string `json:"timestamp"`
}

type BidReveal struct {
	TxType          string `json:"tx_type"`
	TenderID        string `json:"tender_id"`
	BidderID        string `json:"bidder_id"`
	FileCID         string `json:"file_cid"`
	IntegrityStatus string `json:"integrity_status"`
	Timestamp       string `json:"timestamp"`
}

type ReputationRecord struct {
	AgentID              string  `json:"agent_id"`
	VerifiedReputation   float64 `json:"verified_reputation"`
	BehavioralReputation float64 `json:"behavioral_reputation"`
	SocialReputation     float64 `json:"social_reputation"`
	TotalScore           float64 `json:"total_score"`
	LastOutcome          string  `json:"last_outcome"`
	UpdatedAt            string  `json:"updated_at"`
}

const (
	eta   = 0.05  // learning rate (success)
	theta = 0.15  // penalty factor (breach, theta > eta)
)

func (t *TenderFlowContract) CreateTender(ctx contractapi.TransactionContextInterface, payloadJSON string) error {
	var rec TenderRecord
	if err := json.Unmarshal([]byte(payloadJSON), &rec); err != nil {
		return fmt.Errorf("invalid tender payload: %w", err)
	}
	if rec.TenderID == "" {
		return fmt.Errorf("tender_id required")
	}
	rec.Status = "Bidding"
	key := fmt.Sprintf("Tender:%s", rec.TenderID)
	return ctx.GetStub().PutState(key, []byte(payloadJSON))
}

func (t *TenderFlowContract) CommitBid(ctx contractapi.TransactionContextInterface, payloadJSON string) error {
	var c BidCommitment
	if err := json.Unmarshal([]byte(payloadJSON), &c); err != nil {
		return fmt.Errorf("invalid commit payload: %w", err)
	}
	c.TxType = "BID_COMMIT"
	c.CommitPhase = "SEALED"
	c.Timestamp = time.Now().UTC().Format(time.RFC3339)
	if c.BidHash == "" || c.BidderID == "" || c.TenderID == "" {
		return fmt.Errorf("tender_id, bidder_id, bid_hash required")
	}
	key := fmt.Sprintf("Commit:%s:%s", c.TenderID, c.BidderID)
	b, _ := json.Marshal(c)
	return ctx.GetStub().PutState(key, b)
}

func (t *TenderFlowContract) RevealBid(ctx contractapi.TransactionContextInterface, payloadJSON string) error {
	var r BidReveal
	if err := json.Unmarshal([]byte(payloadJSON), &r); err != nil {
		return fmt.Errorf("invalid reveal payload: %w", err)
	}
	r.TxType = "BID_REVEAL"
	r.Timestamp = time.Now().UTC().Format(time.RFC3339)

	commitKey := fmt.Sprintf("Commit:%s:%s", r.TenderID, r.BidderID)
	stored, err := ctx.GetStub().GetState(commitKey)
	if err != nil || stored == nil {
		_ = t.UpdateBehavioralReputation(ctx, r.BidderID, "Breach")
		r.IntegrityStatus = "FAILED_NO_COMMIT"
		return fmt.Errorf("integrity check failed: no prior commitment")
	}

	var commit BidCommitment
	_ = json.Unmarshal(stored, &commit)
	// Simulated hash verification: file_cid must match committed bid_hash prefix in demo
	if !strings.HasPrefix(r.FileCID, commit.BidHash[:min(8, len(commit.BidHash))]) &&
		commit.BidHash != r.FileCID {
		_ = t.UpdateBehavioralReputation(ctx, r.BidderID, "Breach")
		r.IntegrityStatus = "FAILED_HASH_MISMATCH"
		b, _ := json.Marshal(r)
		_ = ctx.GetStub().PutState(fmt.Sprintf("Reveal:%s:%s", r.TenderID, r.BidderID), b)
		return fmt.Errorf("integrity check failed: bid invalid")
	}

	r.IntegrityStatus = "VERIFIED_SUCCESS"
	_ = t.UpdateBehavioralReputation(ctx, r.BidderID, "Success")
	b, _ := json.Marshal(r)
	return ctx.GetStub().PutState(fmt.Sprintf("Reveal:%s:%s", r.TenderID, r.BidderID), b)
}

func (t *TenderFlowContract) UpdateBehavioralReputation(ctx contractapi.TransactionContextInterface, agentID, outcome string) error {
	rep, err := t.getOrInitReputation(ctx, agentID)
	if err != nil {
		return err
	}
	b := rep.BehavioralReputation
	switch outcome {
	case "Success":
		b = b + eta*(1.0-b)
	case "Breach":
		b = b - theta*b
	default:
		return fmt.Errorf("unknown outcome: %s", outcome)
	}
	if b < 0 {
		b = 0
	}
	if b > 1 {
		b = 1
	}
	rep.BehavioralReputation = b
	rep.LastOutcome = outcome
	rep.TotalScore = 0.3*rep.VerifiedReputation + 0.5*rep.BehavioralReputation + 0.2*rep.SocialReputation
	rep.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	bts, _ := json.Marshal(rep)
	return ctx.GetStub().PutState(fmt.Sprintf("Reputation:%s", agentID), bts)
}

func (t *TenderFlowContract) InitReputation(ctx contractapi.TransactionContextInterface, agentID string, verifiedScore float64) error {
	rep := ReputationRecord{
		AgentID:              agentID,
		VerifiedReputation:   verifiedScore,
		BehavioralReputation: 0.5,
		SocialReputation:     0.5,
		TotalScore:           0.3*verifiedScore + 0.25 + 0.10,
		LastOutcome:          "Init",
		UpdatedAt:            time.Now().UTC().Format(time.RFC3339),
	}
	b, _ := json.Marshal(rep)
	return ctx.GetStub().PutState(fmt.Sprintf("Reputation:%s", agentID), b)
}

func (t *TenderFlowContract) GetReputation(ctx contractapi.TransactionContextInterface, agentID string) (string, error) {
	b, err := ctx.GetStub().GetState(fmt.Sprintf("Reputation:%s", agentID))
	if err != nil || b == nil {
		return "", fmt.Errorf("reputation not found for %s", agentID)
	}
	return string(b), nil
}

func (t *TenderFlowContract) getOrInitReputation(ctx contractapi.TransactionContextInterface, agentID string) (*ReputationRecord, error) {
	b, err := ctx.GetStub().GetState(fmt.Sprintf("Reputation:%s", agentID))
	if err != nil || b == nil {
		_ = t.InitReputation(ctx, agentID, 0.75)
		b, _ = ctx.GetStub().GetState(fmt.Sprintf("Reputation:%s", agentID))
	}
	var rep ReputationRecord
	_ = json.Unmarshal(b, &rep)
	return &rep, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func main() {
	chaincode, err := contractapi.NewChaincode(new(TenderFlowContract))
	if err != nil {
		panic(err)
	}
	if err := chaincode.Start(); err != nil {
		panic(err)
	}
}
