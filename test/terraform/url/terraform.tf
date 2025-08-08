terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 5.92"
    }
  }

  required_version = ">= 1.2"

  cloud { 
    organization = "digitalflophouse" 

    workspaces { 
      name = "itty-lambda-testing" 
    } 
  }
}
