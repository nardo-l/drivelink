package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	emailverifier "github.com/AfterShip/email-verifier"
)

type verifyRequest struct {
	Email string `json:"email"`
}

type verifyResponse struct {
	Valid        bool   `json:"valid"`
	Reason       string `json:"reason,omitempty"`
	Suggestion   string `json:"suggestion,omitempty"`
	SyntaxValid  bool   `json:"syntax_valid"`
	HasMXRecords bool   `json:"has_mx_records"`
	MXChecked    bool   `json:"mx_checked"`
	Disposable   bool   `json:"disposable"`
	Free         bool   `json:"free"`
	RoleAccount  bool   `json:"role_account"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")

	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// The endpoint is intended for same-origin app requests only.
	if origin := r.Header.Get("Origin"); origin != "" {
		parsed, err := url.Parse(origin)
		if err != nil || !strings.EqualFold(parsed.Host, r.Host) {
			http.Error(w, `{"error":"Origin not allowed"}`, http.StatusForbidden)
			return
		}
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	defer r.Body.Close()
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	var input verifyRequest
	if err := json.Unmarshal(body, &input); err != nil {
		http.Error(w, `{"error":"Invalid JSON"}`, http.StatusBadRequest)
		return
	}

	email := strings.TrimSpace(input.Email)
	if len(email) == 0 || len(email) > 254 {
		http.Error(w, `{"error":"Enter an email address"}`, http.StatusBadRequest)
		return
	}

	// SMTP mailbox probing is deliberately disabled: it is unreliable on
	// serverless networks and is not proof that a person owns the mailbox.
	verifier := emailverifier.NewVerifier().EnableDomainSuggest().DisableSMTPCheck()
	result, verifyErr := verifier.Verify(email)
	if result == nil {
		http.Error(w, `{"error":"Email verification unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	response := verifyResponse{
		Valid:        result.Syntax.Valid && !result.Disposable,
		SyntaxValid:  result.Syntax.Valid,
		HasMXRecords: result.HasMxRecords,
		MXChecked:    verifyErr == nil,
		Disposable:   result.Disposable,
		Free:         result.Free,
		RoleAccount:  result.RoleAccount,
		Suggestion:   result.Suggestion,
	}

	switch {
	case !result.Syntax.Valid:
		response.Valid = false
		response.Reason = "syntax"
	case result.Disposable:
		response.Valid = false
		response.Reason = "disposable"
	case verifyErr == nil && !result.HasMxRecords:
		response.Valid = false
		response.Reason = "mx"
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response)
}
